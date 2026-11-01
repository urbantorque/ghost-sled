// What the rider is doing this frame, for presentation that is not in the HUD model: the HUD quiets
// the top-centre stack's secondary parts while the rider is in the air (Hud hush). The renderer
// writes it from the sim each frame (chaos.ts, ChaosVisuals.update); it is never read by the sim.

export const ride = {
  /** The rider is off the snow (and not crashed). */
  air: false,
};
