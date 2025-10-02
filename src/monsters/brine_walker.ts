import Phaser from 'phaser';

import { Monster, type MonsterHitbox } from '@game/monster';
import { HitboxManager } from '../combat/hitboxManager';

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
    const hitboxes = super.getHitboxes();
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
