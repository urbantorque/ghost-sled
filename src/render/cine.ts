// Round 7's contract between the camera and the pipeline. The camera's cinematic beats write here each
// frame; the post stack reads it. Nothing in here touches the sim. Every field eases to its rest value in
// the camera, so the pipeline never smooths: it draws what it is given.
export interface CineState {
  /** Depth of field, 0 (none) to 1 (a beat's full blur). The pipeline may ignore it below Ultra. */
  dof: number;
  /** The distance held sharp, metres from the lens (the rider, in a hero frame). */
  focus: number;
  /** Speed-scaled motion blur, 0 to 1, from the speed curve and the beat. */
  motionBlur: number;
  /** Round 8 (speed): how much of the motion blur keeps to the frame's edge, 0 (the whole frame: a whip) to 1
   *  (speed's blur, which leaves the middle of the frame sharp and smears only what rushes past its sides). */
  edge: number;
  /** A beat's letterbox, 0 to 1 (drawn in the composite, never over the HUD's own rows). */
  letterbox: number;
  /** Render time's scale in a slow hero frame, 1 at rest (the sim never slows; this is for effects that
   *  integrate on render time, as particles do). */
  slow: number;
}

export const cine: CineState = { dof: 0, focus: 12, motionBlur: 0, edge: 1, letterbox: 0, slow: 1 };

export function resetCine(): void {
  cine.dof = 0;
  cine.focus = 12;
  cine.motionBlur = 0;
  cine.edge = 1;
  cine.letterbox = 0;
  cine.slow = 1;
}
