"use client";
// The start: pick name, look, state and LGA, then the life is rolled once and revealed.
import { useMemo, useState } from "react";
import { AVATAR_ART, CLOTHS, LOOK_LABELS, SKINS, type Gender } from "@/data/character";
import { CAREERS, EDUCATION_LABEL } from "@/data/careers";
import { LGAS } from "@/data/geography";
import { CLASS_LABEL } from "@/data/jobs";
import { STATES } from "@/data/states";
import { useGame, getGameStore } from "@/store";
import { Button, DISCLAIMER, Modal, cx, naira } from "./ui";

export default function CreateCitizen() {
  const [name, setName] = useState("");
  const [g, setG] = useState<Gender>("m");
  const [skin, setSkin] = useState(SKINS[0]);
  const [cloth, setCloth] = useState(CLOTHS[0]);
  const [stateCode, setStateCode] = useState("kwara");
  const lgas = useMemo(() => LGAS.filter((l) => l.stateCode === stateCode), [stateCode]);
  const [lgaCode, setLgaCode] = useState("kwara/ilorin-west");
  const [error, setError] = useState<string | null>(null);

  const roll = () => {
    if (!name.trim()) return setError("Enter your name");
    setError(getGameStore().getState().createCitizen({ name, look: { g, skin, cloth }, stateCode, lgaCode }));
  };

  return (
    <Modal title="Create your citizen" wide>
      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-b from-[#F3E4C4] to-[#E2C893] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={AVATAR_ART[g]} alt="" className="h-48 object-contain" />
          <span className="text-xs font-semibold text-[#5E6582]">{LOOK_LABELS[g]}</span>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-bold">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="e.g. Muiz" className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-bold">
              State
              <select
                value={stateCode}
                onChange={(e) => {
                  setStateCode(e.target.value);
                  setLgaCode(LGAS.find((l) => l.stateCode === e.target.value)!.code);
                }}
                className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5"
              >
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              Local government
              <select value={lgaCode} onChange={(e) => setLgaCode(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5">
                {lgas.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-soft">This is where you are registered. You can only vote at your polling unit here.</p>
          <div>
            <div className="mb-1 text-sm font-bold">Look</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LOOK_LABELS) as Gender[]).map((k) => (
                <button key={k} type="button" onClick={() => setG(k)} aria-pressed={g === k} className={cx("rounded-full border px-3 py-1.5 text-sm font-bold", g === k ? "border-indigo bg-indigo text-[#F7E7C1]" : "border-line bg-panel-2")}>
                  {LOOK_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Swatches label="Skin tone" values={SKINS} value={skin} onChange={setSkin} />
            <Swatches label="Outfit" values={CLOTHS} value={cloth} onChange={setCloth} />
          </div>
          {error && <p className="text-sm font-bold text-danger">{error}</p>}
          <Button tone="keke" onClick={roll} className="w-full">
            Roll my life
          </Button>
          <p className="text-xs text-ink-soft">Your class, job, home and money are rolled once and kept for good. {DISCLAIMER}</p>
        </div>
      </div>
    </Modal>
  );
}

function Swatches({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-sm font-bold">{label}</div>
      <div className="flex gap-2">
        {values.map((v) => (
          <button key={v} type="button" onClick={() => onChange(v)} aria-label={label} aria-pressed={value === v} style={{ background: v }} className={cx("h-8 w-8 rounded-full border-2 border-line", value === v && "outline-3 outline-offset-2 outline-keke")} />
        ))}
      </div>
    </div>
  );
}

/** Shown once after the roll. */
export function Reveal({ onStart }: { onStart: () => void }) {
  const c = useGame((s) => s.game.citizen)!;
  const money = useGame((s) => s.game.money);
  const lga = LGAS.find((l) => l.code === c.lgaCode)!;
  const state = STATES.find((s) => s.code === c.stateCode)!;
  const stamp = { poor: "text-[#A8322B]", middle: "text-[#C9962B]", rich: "text-[#0E5A3A]" }[c.cls];
  const pvc = c.pvc === "have" ? "You have it" : c.pvc === "registered" ? "Registered, not collected" : "Not registered";
  return (
    <Modal title="Your life">
      <div className={cx("mb-3 inline-block -rotate-3 rounded-lg border-4 border-current px-3 py-1 font-sign text-3xl", stamp)}>{CLASS_LABEL[c.cls]}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {[
          ["Job", `${c.job}${c.employed ? "" : " (looking for work)"}`],
          ["Career", CAREERS[c.career].label],
          ["School", EDUCATION_LABEL[c.education]],
          ["Home", c.home],
          ["Money", naira(money)],
          ["PVC", pvc],
          ["TV at home", c.ownsTv ? "Yes" : "No"],
          ["Radio", c.ownsRadio ? "Yes" : "No"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-bold text-ink-soft">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 font-bold text-[#0E5A3A]">
        {lga.name}, {state.name}: {state.slogan}.
      </p>
      <p className="mt-1 text-sm text-ink-soft">Election day is Saturday 14 November. Live your life on the way to the ballot.</p>
      <Button onClick={onStart} className="mt-4 w-full">
        Start
      </Button>
    </Modal>
  );
}
