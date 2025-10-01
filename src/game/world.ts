export type RoomId = 'hallway' | 'infirmary' | 'office' | 'kitchen' | 'entrance';

export type KeyId = 'nurse_badge' | 'admin_badge' | 'pantry_key' | 'front_door_key';

export type DoorRequirement = { type: 'key'; key: KeyId; label: string };

export type DoorHotspot = { width: number; height: number; offsetX?: number; offsetY?: number };

export type DoorCoords = {
  x: number;
  y: number;
  depth?: number;
  hotspot?: DoorHotspot;
  tooltipOffset?: { x: number; y: number };
};

export type DoorDefinition = {
  /** Shared identifier so both sides of a doorway unlock together. */
  id: string;
  /** The room reached when the player walks through this doorway. */
  target: RoomId;
  sprite: { key: string; frame: string };
  coords: DoorCoords;
  requirement?: DoorRequirement;
};

export type RoomFlow = { id: RoomId; doors: DoorDefinition[] };

const DOOR_SPRITE_ATLAS = 'doors_windows';

const BASE_DEPTH = 5;

const DOOR_COORDS = {
  left: {
    x: 210,
    y: 372,
    depth: BASE_DEPTH,
    hotspot: { width: 150, height: 200, offsetX: 0, offsetY: -10 },
    tooltipOffset: { x: 0, y: -140 },
  },
  right: {
    x: 1070,
    y: 372,
    depth: BASE_DEPTH,
    hotspot: { width: 150, height: 200, offsetX: 0, offsetY: -10 },
    tooltipOffset: { x: 0, y: -140 },
  },
  north: {
    x: 640,
    y: 228,
    depth: BASE_DEPTH,
    hotspot: { width: 200, height: 180, offsetX: 0, offsetY: -20 },
    tooltipOffset: { x: 0, y: -150 },
  },
  south: {
    x: 640,
    y: 580,
    depth: BASE_DEPTH,
    hotspot: { width: 220, height: 180, offsetX: 0, offsetY: -20 },
    tooltipOffset: { x: 0, y: -150 },
  },
} as const satisfies Record<string, DoorCoords>;

const REQUIREMENTS = {
  nurseBadge: { type: 'key', key: 'nurse_badge', label: 'Nurse Badge' } as const,
  adminBadge: { type: 'key', key: 'admin_badge', label: 'Admin Badge' } as const,
  pantryKey: { type: 'key', key: 'pantry_key', label: 'Pantry Key' } as const,
  frontDoorKey: { type: 'key', key: 'front_door_key', label: 'Front Door Key' } as const,
};

export const HOUSE_FLOW: RoomFlow[] = [
  {
    id: 'hallway',
    doors: [
      {
        id: 'hallway_infirmary',
        target: 'infirmary',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_infirmary' },
        coords: DOOR_COORDS.left,
      },
      {
        id: 'hallway_office',
        target: 'office',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_office' },
        coords: DOOR_COORDS.right,
        requirement: REQUIREMENTS.nurseBadge,
      },
    ],
  },
  {
    id: 'infirmary',
    doors: [
      {
        id: 'hallway_infirmary',
        target: 'hallway',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_hall' },
        coords: DOOR_COORDS.right,
      },
      {
        id: 'infirmary_office',
        target: 'office',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_office' },
        coords: DOOR_COORDS.left,
        requirement: REQUIREMENTS.nurseBadge,
      },
      {
        id: 'infirmary_kitchen',
        target: 'kitchen',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_kitchen' },
        coords: DOOR_COORDS.north,
        requirement: REQUIREMENTS.pantryKey,
      },
    ],
  },
  {
    id: 'office',
    doors: [
      {
        id: 'hallway_office',
        target: 'hallway',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_hall' },
        coords: DOOR_COORDS.left,
        requirement: REQUIREMENTS.nurseBadge,
      },
      {
        id: 'infirmary_office',
        target: 'infirmary',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_infirmary' },
        coords: DOOR_COORDS.right,
        requirement: REQUIREMENTS.nurseBadge,
      },
      {
        id: 'office_kitchen',
        target: 'kitchen',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_kitchen' },
        coords: DOOR_COORDS.north,
        requirement: REQUIREMENTS.adminBadge,
      },
    ],
  },
  {
    id: 'kitchen',
    doors: [
      {
        id: 'infirmary_kitchen',
        target: 'infirmary',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_infirmary' },
        coords: DOOR_COORDS.south,
        requirement: REQUIREMENTS.pantryKey,
      },
      {
        id: 'office_kitchen',
        target: 'office',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_office' },
        coords: DOOR_COORDS.left,
        requirement: REQUIREMENTS.adminBadge,
      },
      {
        id: 'kitchen_entrance',
        target: 'entrance',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_entrance' },
        coords: DOOR_COORDS.north,
        requirement: REQUIREMENTS.frontDoorKey,
      },
    ],
  },
  {
    id: 'entrance',
    doors: [
      {
        id: 'kitchen_entrance',
        target: 'kitchen',
        sprite: { key: DOOR_SPRITE_ATLAS, frame: 'door_kitchen' },
        coords: DOOR_COORDS.south,
        requirement: REQUIREMENTS.frontDoorKey,
      },
    ],
  },
];

export function listRoomDoors(roomId: RoomId): DoorDefinition[] {
  return HOUSE_FLOW.find((entry) => entry.id === roomId)?.doors ?? [];
}
