import Phaser from 'phaser';

import { Monster, type MonsterHitbox, type MonsterHitboxDefinition } from '@game/monster';
import { HitboxManager } from '../combat/hitboxManager';
import { sampleHurtboxRig } from '../combat/hurtbox_rig';
import { getShapeBounds } from '../combat/shapes';
import { BRINE_WALKER_HURTBOX_RIG } from '../content/collision/brine_walker';

let idSequence = 0;

export class BrineWalker extends Monster {
  private readonly hurtboxOwnerId: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly hitboxManager: HitboxManager,
  ) {
    super(scene, x, y, 'brine_walker');
    idSequence += 1;
    this.hurtboxOwnerId = `brine_walker:${idSequence}`;
  }

  syncHitboxes() {
    const pose = this.getCurrentPose();
    const state = this.getCurrentHurtState();
    const elapsed = this.getHurtStateElapsed();
    const defs = this.getHitboxDefinitions();
    const fallbackDef: MonsterHitboxDefinition = defs[0] ?? {
      id: 'core',
      part: 'core',
      damageMultiplier: 1,
    };
    let shapes = sampleHurtboxRig(BRINE_WALKER_HURTBOX_RIG, state, elapsed);
    if (shapes.length === 0) {
      shapes = sampleHurtboxRig(BRINE_WALKER_HURTBOX_RIG, 'idle', elapsed);
    }
    const cos = Math.cos(pose.angle);
    const sin = Math.sin(pose.angle);
    const hitboxes: MonsterHitbox[] = shapes.map((shape, index) => {
      const def = defs[index] ?? fallbackDef;
      if (shape.kind === 'circle') {
        const rx = shape.x * cos - shape.y * sin;
        const ry = shape.x * sin + shape.y * cos;
        const worldShape = { kind: 'circle' as const, x: pose.x + rx, y: pose.y + ry, r: shape.r };
        return {
          id: def.id,
          part: def.part,
          shape: worldShape,
          rect: getShapeBounds(worldShape),
          damageMultiplier: def.damageMultiplier ?? 1,
        };
      }
      const a = {
        x: shape.ax * cos - shape.ay * sin,
        y: shape.ax * sin + shape.ay * cos,
      };
      const b = {
        x: shape.bx * cos - shape.by * sin,
        y: shape.bx * sin + shape.by * cos,
      };
      const worldShape = {
        kind: 'capsule' as const,
        ax: pose.x + a.x,
        ay: pose.y + a.y,
        bx: pose.x + b.x,
        by: pose.y + b.y,
        r: shape.r,
      };
      return {
        id: def.id,
        part: def.part,
        shape: worldShape,
        rect: getShapeBounds(worldShape),
        damageMultiplier: def.damageMultiplier ?? 1,
      };
    });
    this.hitboxManager.registerHurtboxes('monsters', this.hurtboxOwnerId, this.toRegistrations(hitboxes));
  }

  private toRegistrations(hitboxes: MonsterHitbox[]) {
    return hitboxes.map((hitbox) => ({
      id: hitbox.id,
      shape: hitbox.shape,
      data: hitbox,
    }));
  }
}
