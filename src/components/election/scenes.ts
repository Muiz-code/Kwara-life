// The two end-of-season videos (docs/DECISIONS.md, "Closing video and admin roles"). Both are generic: no party
// marks and no words in the picture; the party name and colour are laid over in code. Made in Higgsfield.
// - celebration: the Presidential Villa in Abuja under Aso Rock, the camera moving from the gates into the state
//   hall where cartoon Nigerians celebrate. Loops under the winner.
// - closing: a street at dusk, polling tables packed away, a young woman holding up her inked thumb. Plays once.
// Set a path to null to fall back to the animated scene drawn in Finale.tsx (it also falls back if a file fails).
export const SCENE_VIDEO: { celebration: string | null; closing: string | null } = {
  celebration: "/video/celebration.mp4",
  closing: "/video/closing.mp4",
};
