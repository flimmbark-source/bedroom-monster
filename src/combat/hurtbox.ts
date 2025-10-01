export type HurtSpec = {
  core: { halfLen: number; radius: number; footOffsetY: number };
  head?: { offset: number; radius: number };
  tail?: { offset: number; radius: number };
  dashShrink?: number;
};

export const HURTBOX_SPECS: Record<string, HurtSpec> = {
  brine_walker: {
    core: { halfLen: 96, radius: 58, footOffsetY: 14 },
    head: { offset: 110, radius: 42 },
    tail: { offset: 42, radius: 30 },
    dashShrink: 0.85,
  },
};
