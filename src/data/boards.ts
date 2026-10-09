// The kinds of billboard a business can book. Every board is printed front and back, and each face runs
// a carousel: several businesses share it, each ad showing for one slot in turn.

export type BoardType = "classic" | "prime" | "smart" | "square" | "tall" | "wall";

/** A face's shape, width over height. */
export type BoardShape = "wide" | "square" | "tall";
export const SHAPE_ASPECT: Record<BoardShape, number> = { wide: 2, square: 1, tall: 9 / 16 };
/** How big an ad picture is stored for each shape, in pixels. */
export const SHAPE_PX: Record<BoardShape, [number, number]> = { wide: [1024, 512], square: [768, 768], tall: [576, 1024] };

export interface BoardSpec {
  type: BoardType;
  label: string;
  blurb: string;
  /** Takes video ads as well as pictures (an LED screen). */
  video: boolean;
  /** How long each ad stays up before the next, in ms. Smart screens give a video time to play out. */
  slotMs: number;
  /** Most ads sharing one face at a time. */
  queue: number;
  /** Price per showing, against the standard rate. */
  priceFactor: number;
  /** The face's shape. Pictures of any shape show in full; one that matches fills the face. */
  shape: BoardShape;
}

export const BOARDS: Record<BoardType, BoardSpec> = {
  classic: {
    type: "classic", label: "Roadside billboard", video: false, slotMs: 8000, queue: 6, priceFactor: 1, shape: "wide",
    blurb: "A printed board on two steel legs, facing the traffic both ways.",
  },
  prime: {
    type: "prime", label: "Giant unipole", video: false, slotMs: 8000, queue: 8, priceFactor: 1.5, shape: "wide",
    blurb: "A huge lit board high on one pole at the town's edge. Everyone coming into town sees it.",
  },
  smart: {
    type: "smart", label: "Smart LED screen", video: true, slotMs: 15000, queue: 6, priceFactor: 2, shape: "wide",
    blurb: "A wide LED screen that plays video ads up to 15 seconds, bright day and night.",
  },
  square: {
    type: "square", label: "Square board", video: false, slotMs: 8000, queue: 6, priceFactor: 1.2, shape: "square",
    blurb: "A square board high on one pole: made for logos and square pictures.",
  },
  tall: {
    type: "tall", label: "Tall LED screen", video: true, slotMs: 15000, queue: 6, priceFactor: 2, shape: "tall",
    blurb: "A tall portrait screen: made for posters and phone videos filmed upright, up to 15 seconds.",
  },
  // Wall artwork inside a landmark's gallery: one business per frame, ₦25,000 a day (2.5 times a board).
  wall: {
    type: "wall", label: "Gallery wall artwork", video: false, slotMs: 60_000, queue: 1, priceFactor: 2.5, shape: "wide",
    blurb: "A big framed artwork on the wall of the landmark's visitor centre. Every visitor who walks in sees it.",
  },
};

export type BoardFace = "front" | "back";
export const FACES: BoardFace[] = ["front", "back"];

/** Upload limits for video ads on smart screens. */
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

/** The face shape a picture or video of this width and height suits best. */
export function shapeFor(width: number, height: number): BoardShape {
  const r = width / height;
  // Halfway points (in log terms) between the shapes: about 1.41 and 0.75.
  return r >= Math.SQRT2 ? "wide" : r <= 0.75 ? "tall" : "square";
}

/** The kinds of board with a given shape, and whether any of them plays video. */
export const boardsWithShape = (shape: BoardShape) => Object.values(BOARDS).filter((b) => b.shape === shape);
