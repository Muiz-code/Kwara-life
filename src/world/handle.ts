/** What the game screen can ask of the map, whether it is drawn in 2D (GameMap) or 3D (Town3D). */
export interface MapHandle {
  zoomBy(factor: number): void;
  centerOnMe(): void;
  /** Turn the view round. Only the 3D map can. */
  rotateBy?(radians: number): void;
  setActive(active: boolean): void;
  destroy(): void;
}
