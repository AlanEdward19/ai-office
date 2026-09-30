export const FLOORS = ["ground", "hr"] as const;

export type FloorId = (typeof FLOORS)[number];

export const FLOOR_LABELS: Record<FloorId, string> = {
  ground: "Térreo",
  hr: "RH",
};

export const ELEVATOR = { x: 7.55, z: 3.85 };

export function isFloorId(value: unknown): value is FloorId {
  return value === "ground" || value === "hr";
}

/** The elevator only changes which floor is visible. It does not load a page. */
export function rideElevator(floor: FloorId): FloorId {
  return floor === "ground" ? "hr" : "ground";
}
