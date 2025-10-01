export type HurtSpec = {
  core: { halfLen: number; radius: number; footOffsetY: number };
  head?: { offset: number; radius: number };
  tail?: { offset: number; radius: number };
  dashShrink?: number;
};

export const HURTBOX_SPECS: Record<string, HurtSpec> = {
  brine_walker: {
    core: { halfLen: 68, radius: 38, footOffsetY: 14 },
    head: { offset: 76, radius: 28 },
    tail: { offset: 42, radius: 30 },
    dashShrink: 0.85,
  },
};
