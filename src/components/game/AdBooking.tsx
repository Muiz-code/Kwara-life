"use client";
// Book a billboard: pick a face (front, back or both), upload a picture (or a video on a smart screen),
// name the business, choose how many days, pay (simulated for now) and the ad joins that face's
// carousel. Political promotion is refused. Ads can carry the business's website: tapping a board shows
// what is on it now, and a player can visit an ad's site in a new tab after a "you're leaving" check.
import { useState } from "react";
import { Check, ExternalLink, ImageUp, Loader2, ShieldCheck, Video } from "lucide-react";
import { BOARDS, SHAPE_ASPECT, SHAPE_PX, boardsWithShape, shapeFor, type BoardFace, type BoardShape } from "@/data/boards";
import { adTextProblem, boardDayPrice, boardTypeOf, clampDays, cleanAdLink, DAY_OPTIONS, daysUntil, linkHost, simulatePayment, type AdBooking as Booked } from "@/sim/ads";
import { MAX_AD_DAYS, PRICE_PER_DAY } from "@/data/ads";
import { usePlotBoards } from "@/store/plot-boards";
import { adsStore, faceQueue, useAds } from "@/store/ads";
import { saveVideo, videoProblem } from "@/store/ad-media";
import { Button, Modal, naira } from "./ui";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Put a picture or a video frame on the board, as a compact JPEG.
 * fit: the whole picture shows, nothing cut off; the space round it is a soft, blurred, darkened copy of
 * the same picture so the board is never left with plain bars. fill: zoom in to cover the board, cutting
 * whatever sticks out (best for wide pictures).
 */
function cropToBoard(src: CanvasImageSource, w0: number, h0: number, mode: "fit" | "fill", size: [number, number]): string {
  const [W, H] = size;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const cover = Math.max(W / w0, H / h0);
  if (mode === "fill") {
    g.drawImage(src, (W - w0 * cover) / 2, (H - h0 * cover) / 2, w0 * cover, h0 * cover);
    return c.toDataURL("image/jpeg", 0.82);
  }
  // The blurred backdrop: shrink the picture to a few pixels and stretch it back up. Smoothing does the
  // blur, which works in every browser (canvas blur filters don't work in older Safari).
  const tiny = document.createElement("canvas");
  tiny.width = 16;
  tiny.height = 8;
  const t = tiny.getContext("2d")!;
  t.drawImage(src, (16 - w0 * cover * (16 / W)) / 2, (8 - h0 * cover * (8 / H)) / 2, w0 * cover * (16 / W), h0 * cover * (8 / H));
  // Up in two steps, so the blur is soft rather than blotchy.
  const mid = document.createElement("canvas");
  mid.width = 96;
  mid.height = 48;
  const m = mid.getContext("2d")!;
  m.imageSmoothingEnabled = true;
  m.imageSmoothingQuality = "high";
  m.drawImage(tiny, 0, 0, 96, 48);
  m.globalAlpha = 0.5;
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) m.drawImage(mid, dx, dy);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(mid, 0, 0, W, H);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(0, 0, W, H);
  // The whole picture on top, with a small margin.
  const fit = Math.min(W / w0, H / h0) * 0.96;
  g.drawImage(src, (W - w0 * fit) / 2, (H - h0 * fit) / 2, w0 * fit, h0 * fit);
  return c.toDataURL("image/jpeg", 0.85);
}

/** What reading an upload gives: the picture for the board, and the shape the original was. */
interface Prepared {
  image: string;
  shape: BoardShape;
}

/** A still from a video, one second in: shown on the board while the video loads, and in the booking. */
async function posterFrame(file: File, mode: "fit" | "fill", size: [number, number]): Promise<Prepared> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () => fail(new Error("We can't play that video. Try an MP4"));
    });
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      v.currentTime = Math.min(1, v.duration / 2 || 0);
    });
    return { image: cropToBoard(v, v.videoWidth, v.videoHeight, mode, size), shape: shapeFor(v.videoWidth, v.videoHeight) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Read a picture file and crop it to the board, as a compact JPEG. */
async function toBoard(file: File, mode: "fit" | "fill", size: [number, number]): Promise<Prepared> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("That file is not a picture we can read"));
      i.src = url;
    });
    return { image: cropToBoard(img, img.width, img.height, mode, size), shape: shapeFor(img.width, img.height) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Step = "board" | "form" | "pay" | "paying" | "done";

const FACE_LABEL: Record<BoardFace | "both", string> = { front: "Front", back: "Back", both: "Both faces" };

export default function AdBooking({ mapId, boardId, onClose }: { mapId: string; boardId: string; onClose: () => void }) {
  // Poster grounds carry civic posters and the in-game campaign flyers, not paid ads.
  if (boardId.startsWith("posters-")) return <PosterGround onClose={onClose} />;
  return <Booking mapId={mapId} boardId={boardId} onClose={onClose} />;
}

function PosterGround({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Poster ground">
      <p className="mb-3 text-sm text-ink-soft">
        This hoarding carries civic posters (get your PVC, know your polling unit) and campaign flyers. Post a flyer from the Campaign tab;
        paid business ads go on the billboards.
      </p>
      <Button onClick={onClose} className="w-full">OK</Button>
    </Modal>
  );
}

/** Open an ad's website in a new tab, checked again first: a link that no longer passes is never opened. */
function visit(link: string) {
  const ok = cleanAdLink(link);
  if ("url" in ok) window.open(ok.url, "_blank", "noopener,noreferrer");
}

/** What is showing on the board now, face by face, with a way to visit each ad's website. */
function OnBoard({ ads, onBook, onClose }: { ads: { face: BoardFace; ad: Booked }[]; onBook: () => void; onClose: () => void }) {
  const [leaving, setLeaving] = useState<Booked | null>(null);
  if (leaving?.link)
    return (
      <div className="space-y-3">
        <p className="text-sm">
          You&apos;re leaving Naija Votes to visit <span className="font-bold">{leaving.title}</span> at <span className="font-bold">{linkHost(leaving.link)}</span>. It opens in a new tab; the game keeps running here.
        </p>
        <p className="text-xs text-ink-soft">Businesses put up their own links. Never type your PVC number, bank details or passwords on a site you reached from an ad.</p>
        <div className="flex gap-2">
          <Button tone="ghost" onClick={() => setLeaving(null)} className="flex-1">Stay</Button>
          <Button
            onClick={() => {
              visit(leaving.link!);
              setLeaving(null);
            }}
            className="flex-1"
          >
            <span className="inline-flex items-center gap-1.5">Open site <ExternalLink aria-hidden className="h-4 w-4" /></span>
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {ads.map(({ face, ad }) => (
          <li key={`${face}-${ad.ref}`} className="flex items-center gap-3 rounded-xl bg-panel-2 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ad.image} alt="" className="aspect-[2/1] w-20 shrink-0 rounded-md object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{ad.title}</span>
              <span className="block text-xs text-ink-soft">
                {FACE_LABEL[face]} face{ad.link ? ` · ${linkHost(ad.link)}` : ""}
              </span>
            </span>
            {ad.link && (
              <Button small onClick={() => setLeaving(ad)}>
                <span className="inline-flex items-center gap-1">Visit <ExternalLink aria-hidden className="h-3.5 w-3.5" /></span>
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button tone="ghost" onClick={onClose} className="flex-1">Close</Button>
        <Button onClick={onBook} className="flex-1">Advertise here</Button>
      </div>
    </div>
  );
}

function Booking({ mapId, boardId: tapped, onClose }: { mapId: string; boardId: string; onClose: () => void }) {
  const queue = useAds((s) => s.queue);
  // A plot board: the advertiser can pick any of the town's plot boards, not only the one tapped.
  const [boardId, setBoardId] = useState(tapped);
  const plots = usePlotBoards();
  const type = boardTypeOf(boardId);
  const spec = BOARDS[type];
  const [face, setFace] = useState<BoardFace | "both">("both");
  const [video, setVideo] = useState<File | null>(null);
  const [now] = useState(() => Date.now());
  const sharing = (f: BoardFace) => faceQueue(queue, mapId, boardId, f, now);
  const faces: BoardFace[] = face === "both" ? ["front", "back"] : [face];
  const full = faces.some((f) => sharing(f).length >= spec.queue);
  // Ads on the board now, on each face (an ad on both faces is listed once).
  const showing = (["front", "back"] as const).flatMap((f) => sharing(f).map((ad) => ({ face: f, ad: ad as Booked })));
  const onBoard = showing.filter((x, i) => showing.findIndex((y) => y.ad.ref === x.ad.ref) === i);
  const [step, setStep] = useState<Step>(() => (onBoard.length ? "board" : "form"));
  const [link, setLink] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [layout, setLayout] = useState<"fit" | "fill">("fit");
  /** The shape of what was uploaded, to suggest the board made for it. */
  const [uploadShape, setUploadShape] = useState<BoardShape | null>(null);
  const px = SHAPE_PX[spec.shape];
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [days, setDays] = useState(DAY_OPTIONS[1]);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const price = boardDayPrice(days, type, face);

  const pick = async (f: File | undefined, mode: "fit" | "fill" = layout) => {
    setError(null);
    if (!f) return;
    setFile(f);
    if (spec.video && f.type.startsWith("video/")) {
      const why = await videoProblem(f);
      if (why) return setError(why);
      try {
        const r = await posterFrame(f, mode, px);
        setImage(r.image);
        setUploadShape(r.shape);
        setVideo(f);
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return setError(spec.video ? "Use a picture (PNG, JPG, WebP) or a video (MP4, WebM)" : "Use a PNG, JPG or WebP picture");
    setVideo(null);
    if (f.size > MAX_BYTES) return setError("The picture is too big. Keep it under 8 MB");
    try {
      const r = await toBoard(f, mode, px);
      setImage(r.image);
      setUploadShape(r.shape);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const linkCheck = link.trim() ? cleanAdLink(link) : null;
  const next = () => {
    const why = linkCheck && "error" in linkCheck ? linkCheck.error : full ? "That face is fully booked. Pick the other face, or come back when an ad finishes" : !image ? (spec.video ? "Upload your ad picture or video" : "Upload your ad picture") : adTextProblem(title, details) ?? (!agree ? "Confirm the ad follows the rules" : null);
    if (why) return setError(why);
    setError(null);
    setStep("pay");
  };

  const pay = async () => {
    setStep("paying");
    const r = await simulatePayment(price);
    if (!r.ok) {
      setError(r.reason);
      return setStep("pay");
    }
    let videoId: string | undefined;
    if (video) {
      try {
        videoId = await saveVideo(video);
      } catch (e) {
        setError((e as Error).message);
        return setStep("pay");
      }
    }
    adsStore.getState().book({ ref: r.ref, mapId, boardId, title: title.trim(), image: image!, showings: 0, days, until: daysUntil(r.paidAt, days), price, paidAt: r.paidAt, face, type, ...(videoId ? { video: videoId } : {}), ...(linkCheck && "url" in linkCheck ? { link: linkCheck.url } : {}) });
    setRef(r.ref);
    setStep("done");
  };

  return (
    <Modal title={step === "done" ? "Your ad is up" : step === "board" ? `On this ${spec.label.toLowerCase()} now` : `Advertise on this ${spec.label.toLowerCase()}`}>
      {step === "board" && <OnBoard ads={onBoard} onBook={() => setStep("form")} onClose={onClose} />}
      {step === "form" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            {spec.blurb}{" "}
            Each face takes turns between up to {spec.queue} businesses, {spec.slotMs / 1000} seconds each.
          </p>
          {tapped.startsWith("plot-") && plots.length > 1 && (
            <label className="block text-sm font-bold">
              Which plot
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2 font-semibold"
              >
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="mt-0.5 block text-xs font-normal text-ink-soft">Your board goes up on this plot in town.</span>
            </label>
          )}
          <div>
            <span className="text-sm font-bold">Which face</span>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(["front", "back", "both"] as const).map((f) => {
                const used = f === "both" ? Math.max(sharing("front").length, sharing("back").length) : sharing(f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={face === f}
                    onClick={() => setFace(f)}
                    className={`rounded-xl border px-2 py-1.5 text-sm font-bold ${face === f ? "border-indigo bg-indigo text-[#F7E7C1]" : "border-line bg-panel-2"}`}
                  >
                    {FACE_LABEL[f]}
                    <span className="block text-[11px] font-semibold opacity-75">{used}/{spec.queue} booked</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* The picture, previewed on a board. */}
          <label className="block cursor-pointer">
            <div
              className={`relative overflow-hidden rounded-xl border-4 border-[#2B2F36] bg-panel-2 ${spec.shape === "tall" ? "mx-auto w-1/2" : spec.shape === "square" ? "mx-auto w-2/3" : "w-full"}`}
              style={{ aspectRatio: String(SHAPE_ASPECT[spec.shape]) }}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Your ad on the board" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-soft">
                  <ImageUp aria-hidden className="h-8 w-8" />
                  <span className="text-sm font-semibold">{spec.video ? "Upload your ad picture or video" : "Upload your ad picture"}</span>
                  <span className="text-xs">
                    {spec.video ? "Video: MP4 or WebM, up to 15 seconds, 20 MB. " : ""}PNG, JPG or WebP. Any shape: the whole picture shows
                  </span>
                </div>
              )}
            </div>
            {image && uploadShape && uploadShape !== spec.shape && (
              <span className="mt-1.5 block rounded-lg bg-[#E0A526]/15 px-2 py-1.5 text-xs font-semibold">
                Your {video ? "video" : "picture"} is {uploadShape === "wide" ? "wide" : uploadShape === "tall" ? "tall (portrait)" : "square"}. It shows in full here,
                but {boardsWithShape(uploadShape).filter((b) => !video || b.video).map((b) => b.label.toLowerCase()).join(" or ") || "a board of that shape"}
                {" "}along the roadside {boardsWithShape(uploadShape).length > 1 ? "show" : "shows"} it best.
              </span>
            )}
            {image && (
              <span className="mt-1.5 flex gap-1.5" role="group" aria-label="How the picture sits on the board">
                {(
                  [
                    ["fit", "Show all of it"],
                    ["fill", "Fill the board (cuts edges)"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={layout === m}
                    onClick={(e) => {
                      e.preventDefault();
                      setLayout(m);
                      void pick(file ?? undefined, m);
                    }}
                    className={`rounded-lg border px-2 py-1 text-xs font-bold ${layout === m ? "border-indigo bg-indigo text-[#F7E7C1]" : "border-line bg-panel-2"}`}
                  >
                    {label}
                  </button>
                ))}
              </span>
            )}
            {video && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
                <Video aria-hidden className="h-3.5 w-3.5" /> Video ad: {video.name}. The board shows this frame while it loads.
              </span>
            )}
            <input
              type="file"
              accept={spec.video ? "image/png,image/jpeg,image/webp,video/mp4,video/webm" : "image/png,image/jpeg,image/webp"}
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          <label className="block text-sm font-bold">
            Business name
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="e.g. Mama Ronke Jollof" className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2" />
          </label>
          <label className="block text-sm font-bold">
            What it is for <span className="font-normal text-ink-soft">(optional)</span>
            <input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={80} placeholder="e.g. Party rice for every occasion" className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2" />
          </label>
          <label className="block text-sm font-bold">
            Website link <span className="font-normal text-ink-soft">(optional)</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              maxLength={200}
              inputMode="url"
              autoComplete="url"
              placeholder="e.g. mamaronke.com"
              className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2"
            />
            <span className="mt-0.5 block text-xs font-normal text-ink-soft">
              {linkCheck && "url" in linkCheck ? `Players who tap the board can visit ${linkHost(linkCheck.url)}` : "Players who tap the board can visit your site. Secure (https) links only."}
            </span>
          </label>
          <div>
            <span className="text-sm font-bold">How many days</span>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {DAY_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={days === n}
                  onClick={() => setDays(n)}
                  className={`rounded-xl border px-2 py-1.5 text-sm font-bold ${days === n ? "border-indigo bg-indigo text-[#F7E7C1]" : "border-line bg-panel-2"}`}
                >
                  {n === 1 ? "1 day" : `${n} days`}
                </button>
              ))}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_AD_DAYS}
                value={days}
                aria-label="Number of days"
                onChange={(e) => setDays(clampDays(Number(e.target.value)))}
                className="rounded-xl border border-line bg-panel-2 px-2 py-1.5 text-center text-sm font-bold"
              />
            </div>
            <p className="mt-1 text-sm">
              Price: <span className="font-bold">{naira(price)}</span>{" "}
              <span className="text-ink-soft">
                ({naira(PRICE_PER_DAY)} a day{spec.priceFactor !== 1 ? `, times ${spec.priceFactor} on a ${spec.label.toLowerCase()}` : ""}
                {face === "both" ? ", for each face" : ""}. Up to {MAX_AD_DAYS} days, the whole season)
              </span>
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            My ad is for a business, has no party, candidate or campaign message, and I have the right to use the picture.
          </label>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button tone="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={next} className="flex-1">Continue to payment</Button>
          </div>
        </div>
      )}

      {(step === "pay" || step === "paying") && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-[#E0A526] bg-[#E0A526]/10 p-3 text-sm">
            <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[#B5791A]" />
            <span>
              <span className="font-bold">Test mode.</span> This checkout is a simulation: no card details are taken and no money moves. Real payment (Paystack) comes with the ads service.
            </span>
          </div>
          <div className="rounded-xl bg-panel-2 p-3 text-sm">
            <div className="flex justify-between"><span>{title.trim()}</span><span className="font-bold">{naira(price)}</span></div>
            <div className="text-xs text-ink-soft">
              {days === 1 ? "1 day" : `${days} days`} on this {spec.label.toLowerCase()}, {face === "both" ? "both faces" : `${face} face`}
              {video ? ", video ad" : ""}
              {linkCheck && "url" in linkCheck ? `, links to ${linkHost(linkCheck.url)}` : ""}
            </div>
            <div className="mt-2 text-xs text-ink-soft">Paying with Paystack test card 4084 0840 8408 4081</div>
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button tone="ghost" onClick={() => setStep("form")} disabled={step === "paying"} className="flex-1">Back</Button>
            <Button onClick={pay} disabled={step === "paying"} className="flex-1">
              {step === "paying" ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Processing</span>
              ) : (
                `Pay ${naira(price)} (test)`
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-3 text-center">
          <Check aria-hidden className="mx-auto h-12 w-12 rounded-full bg-[#0E7A4B] p-2 text-white" />
          <p className="text-sm">
            <span className="font-bold">{title.trim()}</span> has joined the carousel on {face === "both" ? "both faces" : `the ${face} face`} of this{" "}
            {spec.label.toLowerCase()}, for {days === 1 ? "1 day" : `${days} days`}.
          </p>
          <p className="text-xs text-ink-soft">Reference {ref}. Test payment: nothing was charged. Ads booked now show in this browser only until the ads service is live.</p>
          <Button onClick={onClose} className="w-full">See it in town</Button>
        </div>
      )}
    </Modal>
  );
}
