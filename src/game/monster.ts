import Phaser from 'phaser';
import { ROOM_W, ROOM_H } from './config';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  hp = 12;
  state: 'wander'|'chase'|'engage' = 'wander';
  actionT = { sweep: 2.5, smash: 4.0, rush: 5.0, roar: 7.0 };
  cd = { sweep: 0, smash: 0, rush: 0, roar: 0 };
  speed = 140;
  target?: Phaser.Types.Physics.Arcade.GameObjectWithBody;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(18).setOffset(0,0).setTint(0xff8844);
  }

  update(dt: number, player: Phaser.Physics.Arcade.Sprite) {
    const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this.state = d > 300 ? 'wander' : d > 140 ? 'chase' : 'engage';

    // cooldowns
    for (const k in this.cd) (this.cd as any)[k] = Math.max(0, (this.cd as any)[k] - dt);

    // simple steering
    if (this.state === 'wander') {
      this.scene.physics.moveToObject(this, player, this.speed * 0.6);
    } else if (this.state === 'chase') {
      this.scene.physics.moveToObject(this, player, this.speed * 1.0);
    } else {
      this.scene.physics.moveToObject(this, player, this.speed * 1.1);
      // try an action (telegraph not yet visualized; placeholder effects)
      if (this.cd.sweep === 0) { this.sweep(player); this.cd.sweep = this.actionT.sweep; }
      else if (this.cd.smash === 0) { this.smash(player); this.cd.smash = this.actionT.smash; }
      else if (this.cd.rush === 0) { this.rush(player); this.cd.rush = this.actionT.rush; }
      else if (this.cd.roar === 0) { this.roar(player); this.cd.roar = this.actionT.roar; }
    }
  }

  sweep(player: Phaser.Physics.Arcade.Sprite) {
    // close cone check → knockback  
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 80) {
      player.emit('hit', { dmg: 1, type: 'sweep' });
    }
  }
  smash(player: Phaser.Physics.Arcade.Sprite) {
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 120) {
      player.emit('hit', { dmg: 1, type: 'smash' });
    }
  }
  rush(player: Phaser.Physics.Arcade.Sprite) {
    // brief burst
    const v = this.scene.physics.velocityFromRotation(
      Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y), 320);
    this.setVelocity(v.x, v.y);
  }
  roar(player: Phaser.Physics.Arcade.Sprite) {
    // slow effect placeholder
    this.setTintFill(0xffaa66);
    this.scene.time.delayedCall(200, () => this.clearTint());
  }
}
