import Phaser from 'phaser';
import { ROOM_W, ROOM_H } from './config';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  hp = 12;
  private hpMax = this.hp;
  state: 'wander'|'chase'|'engage' = 'wander';
  actionT = { sweep: 2.5, smash: 4.0, rush: 5.0, roar: 7.0 };
  cd = { sweep: 0, smash: 0, rush: 0, roar: 0 };
  speed = 140;
  target?: Phaser.Types.Physics.Arcade.GameObjectWithBody;
  private baseTint = 0xff8844;
  private baseScale = { x: 1, y: 1 };
  private baseAngle = 0;
  private actionLock = false;
  private currentChain?: Phaser.Tweens.TweenChain;
  private idleTween?: Phaser.Tweens.Tween;
  private telegraphDepth = 90;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private hpBarWidth = 52;

  setDepth(value: number): this {
    super.setDepth(value);
    if (this.hpBarBg) this.hpBarBg.setDepth(value + 3);
    if (this.hpBarFill) this.hpBarFill.setDepth(value + 4);
    return this;
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'monster-circle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(40, 40);
    this.setCircle(18, 2, 2);
    this.setTintFill(this.baseTint);

    // HP bar visuals hover above the monster and track its current health.
    const barY = this.getHpBarY();
    this.hpBarBg = scene.add.rectangle(x, barY, this.hpBarWidth + 4, 8, 0x07090d, 0.65)
      .setOrigin(0.5, 0.5)
      .setDepth(this.depth + 3);
    this.hpBarFill = scene.add.rectangle(x - this.hpBarWidth / 2, barY, this.hpBarWidth, 4, 0xff6f6f)
      .setOrigin(0, 0.5)
      .setDepth(this.depth + 4);
    this.refreshHpBar();

    // Gentle idle breathing so the monster feels alive between actions.
    this.idleTween = scene.tweens.add({
      targets: this,
      scaleX: { from: 1, to: 1.04 },
      scaleY: { from: 1, to: 0.96 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(dt: number, player: Phaser.Physics.Arcade.Sprite) {
    this.layoutHpBar();
    const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this.state = d > 300 ? 'wander' : d > 140 ? 'chase' : 'engage';

    // cooldowns
    for (const k in this.cd) (this.cd as any)[k] = Math.max(0, (this.cd as any)[k] - dt);

    // maintain a gentle sway while walking unless a telegraph is running.
    if (!this.actionLock && this.body) {
      const speed = (this.body.velocity.length() || 0);
      if (speed > 40) {
        this.idleTween?.pause();
        this.setScale(1.05, 0.95);
      } else if (!this.currentChain) {
        this.resetPose();
        this.idleTween?.resume();
      }
    }

    if (this.actionLock) return;

    // simple steering
    if (this.state === 'wander') {
      this.scene.physics.moveToObject(this, player, this.speed * 0.6);
    } else if (this.state === 'chase') {
      this.scene.physics.moveToObject(this, player, this.speed * 1.0);
    } else {
      this.scene.physics.moveToObject(this, player, this.speed * 1.1);
      // pick an action; each handler manages its telegraph and cooldown timing
      if (this.cd.sweep === 0) { this.sweep(player); this.cd.sweep = this.actionT.sweep; }
      else if (this.cd.smash === 0) { this.smash(player); this.cd.smash = this.actionT.smash; }
      else if (this.cd.rush === 0) { this.rush(player); this.cd.rush = this.actionT.rush; }
      else if (this.cd.roar === 0) { this.roar(player); this.cd.roar = this.actionT.roar; }
    }
  }

  private getHpBarY() {
    return this.y - this.displayHeight * 0.5 - 18;
  }

  private layoutHpBar() {
    const barY = this.getHpBarY();
    this.hpBarBg.setPosition(this.x, barY);
    this.hpBarFill.setPosition(this.x - this.hpBarWidth / 2, barY);
  }

  refreshHpBar(): void {
    const ratio = Phaser.Math.Clamp(this.hp / this.hpMax, 0, 1);
    this.hpBarFill.setDisplaySize(this.hpBarWidth * ratio, 4);
    const tint = ratio > 0.6 ? 0x7ee57d : ratio > 0.3 ? 0xffd76f : 0xff6f6f;
    this.hpBarFill.setFillStyle(tint);
    this.layoutHpBar();
  }

  preDestroy(): void {
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    super.preDestroy();
  }

  private startAction(
    config: {
      telegraph: Phaser.Types.Tweens.TweenBuilderConfig | Phaser.Types.Tweens.TweenBuilderConfig[];
      attack: Phaser.Types.Tweens.TweenBuilderConfig | Phaser.Types.Tweens.TweenBuilderConfig[];
      cooldown: { duration: number; onStart?: () => void };
    }
  ) {
    if (this.actionLock) return;

    this.actionLock = true;
    this.setVelocity(0, 0);
    this.currentChain?.stop();
    this.idleTween?.pause();

    const telegraphTweens = Array.isArray(config.telegraph) ? config.telegraph : [config.telegraph];
    const attackTweens = Array.isArray(config.attack) ? config.attack : [config.attack];

    const sequence = [...telegraphTweens, ...attackTweens];

    this.currentChain = this.scene.tweens.chain({
      targets: this,
      tweens: sequence,
      onComplete: () => {
        this.currentChain = undefined;
        config.cooldown.onStart?.();
        this.scene.time.delayedCall(config.cooldown.duration, () => {
          this.resetPose();
          this.actionLock = false;
          this.idleTween?.resume();
        });
      },
    });
  }

  private resetPose() {
    this.setScale(this.baseScale.x, this.baseScale.y);
    this.setAngle(this.baseAngle);
    this.setTint(this.baseTint);
  }

  sweep(player: Phaser.Physics.Arcade.Sprite) {
    this.startAction({
      telegraph: {
        duration: 360,
        scaleX: 0.88,
        scaleY: 1.18,
        angle: -22,
        ease: 'Sine.easeOut',
        onStart: () => {
          this.setTint(0xffbb55);
          this.showSweepTelegraph(player, 120, 0xffbb55, '🌀', 420);
          this.spawnImpactEmoji(this.x, this.y - 36, '🌀', 0xffe6b3, 420);
        },
      },
      attack: [
        {
          duration: 220,
          scaleX: 1.36,
          scaleY: 0.74,
          angle: 24,
          ease: 'Back.easeOut',
          onStart: () => {
            if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 80) {
              player.emit('hit', { dmg: 1, type: 'sweep' });
              this.spawnImpactEmoji(player.x, player.y - 20, '💫', 0xffd18a);
            }
          },
        },
        {
          duration: 200,
          scaleX: this.baseScale.x,
          scaleY: this.baseScale.y,
          angle: this.baseAngle,
          ease: 'Sine.easeInOut',
        },
      ],
      cooldown: {
        duration: 360,
        onStart: () => this.enterCooldownPose(0xffa95a),
      },
    });
  }
  smash(player: Phaser.Physics.Arcade.Sprite) {
    this.startAction({
      telegraph: [
        {
          duration: 220,
          scaleX: 1.08,
          scaleY: 0.92,
          ease: 'Quad.easeOut',
          onStart: () => {
            this.setTint(0xffcc77);
            this.showSmashTelegraph(player, 130, 0xffcc77, '🔨', 420);
            this.spawnImpactEmoji(this.x, this.y - 44, '💢', 0xfff2c6, 420);
          },
        },
        {
          duration: 180,
          scaleX: 0.82,
          scaleY: 1.22,
          ease: 'Quad.easeIn',
        },
      ],
      attack: [
        {
          duration: 180,
          scaleX: 1.42,
          scaleY: 0.7,
          ease: 'Bounce.easeOut',
          onStart: () => {
            if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 120) {
              player.emit('hit', { dmg: 1, type: 'smash' });
              this.spawnImpactEmoji(player.x, player.y - 26, '💥', 0xfff2c6);
            }
          },
        },
        {
          duration: 220,
          scaleX: this.baseScale.x,
          scaleY: this.baseScale.y,
          angle: this.baseAngle,
          ease: 'Sine.easeInOut',
        },
      ],
      cooldown: {
        duration: 480,
        onStart: () => this.enterCooldownPose(0xffb067),
      },
    });
  }
  rush(player: Phaser.Physics.Arcade.Sprite) {
    this.startAction({
      telegraph: [
        {
          duration: 200,
          scaleX: 0.9,
          scaleY: 1.16,
          ease: 'Quad.easeOut',
          onStart: () => {
            this.setTint(0xeeaa55);
            this.showRushTelegraph(player, 280, 0xeeaa55, '⚡', 400);
            this.spawnImpactEmoji(this.x, this.y - 34, '👣', 0xffe6bb, 360);
          },
        },
        {
          duration: 160,
          scaleX: 1.04,
          scaleY: 0.94,
          ease: 'Sine.easeInOut',
        },
      ],
      attack: [
        {
          duration: 120,
          scaleX: 1.48,
          scaleY: 0.72,
          ease: 'Expo.easeOut',
          onStart: () => {
            const v = this.scene.physics.velocityFromRotation(
              Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y), 340);
            this.setVelocity(v.x, v.y);
          },
        },
        {
          duration: 260,
          scaleX: this.baseScale.x,
          scaleY: this.baseScale.y,
          ease: 'Quad.easeOut',
          onStart: () => this.scene.time.delayedCall(80, () => this.setVelocity(0, 0)),
          onComplete: () => this.spawnImpactEmoji(this.x, this.y - 28, '💢', 0xffe0b3),
        },
      ],
      cooldown: {
        duration: 420,
        onStart: () => this.enterCooldownPose(0xeeaa55),
      },
    });
  }
  roar(player: Phaser.Physics.Arcade.Sprite) {
    this.startAction({
      telegraph: [
        {
          duration: 240,
          scaleX: 0.96,
          scaleY: 1.12,
          ease: 'Sine.easeInOut',
          onStart: () => {
            this.setTintFill(0xffdd88);
            this.showRoarTelegraph(190, 0xffdd88, '🗯️', 440);
            this.spawnImpactEmoji(this.x, this.y - 48, '😤', 0xfff2c6, 440);
          },
        },
        {
          duration: 200,
          scaleX: 1.08,
          scaleY: 1.12,
          ease: 'Sine.easeIn',
        },
      ],
      attack: [
        {
          duration: 200,
          scaleX: 1.18,
          scaleY: 1.18,
          ease: 'Sine.easeOut',
          onStart: () => {
            player.emit('hit', { dmg: 0, type: 'roar' });
            this.spawnImpactEmoji(player.x, player.y - 34, '😱', 0xfff2c6);
          },
        },
        {
          duration: 200,
          scaleX: this.baseScale.x,
          scaleY: this.baseScale.y,
          ease: 'Sine.easeOut',
          onStart: () => this.setTint(this.baseTint),
        },
      ],
      cooldown: {
        duration: 360,
        onStart: () => this.enterCooldownPose(this.baseTint),
      },
    });
  }

  private showSweepTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    range: number,
    color: number,
    emoji: string,
    duration: number,
  ) {
    const spread = Phaser.Math.DegToRad(150);
    const gfx = this.scene.add.graphics({ x: this.x, y: this.y })
      .setDepth(this.telegraphDepth)
      .setScale(0.4)
      .setAlpha(0.85);
    gfx.fillStyle(color, 0.2);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, range, -spread / 2, spread / 2, false);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(3, color, 0.95);
    gfx.beginPath();
    gfx.arc(0, 0, range, -spread / 2, spread / 2, false);
    gfx.strokePath();

    const icon = this.scene.add.text(this.x, this.y, emoji, { fontSize: '30px' })
      .setOrigin(0.5)
      .setDepth(this.telegraphDepth + 1)
      .setAlpha(0.95)
      .setScale(0.85);

    const updatePositions = () => {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      gfx.setPosition(this.x, this.y);
      gfx.setRotation(angle);
      const tipX = this.x + Math.cos(angle) * range * 0.9;
      const tipY = this.y + Math.sin(angle) * range * 0.9;
      if (icon.active) icon.setPosition(tipX, tipY - 20);
    };

    updatePositions();

    this.scene.tweens.add({
      targets: gfx,
      scale: { from: 0.4, to: 1 },
      alpha: { from: 0.85, to: 0 },
      ease: 'Cubic.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.95, to: 0 },
      scale: { from: 0.85, to: 1.25 },
      ease: 'Sine.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => icon.destroy(),
    });
  }

  private showSmashTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    range: number,
    color: number,
    emoji: string,
    duration: number,
  ) {
    const circle = this.scene.add.circle(this.x, this.y, range * 0.55, color, 0.2)
      .setDepth(this.telegraphDepth)
      .setStrokeStyle(3, color, 0.95)
      .setScale(0.3)
      .setAlpha(0.85);
    const icon = this.scene.add.text(this.x, this.y, emoji, { fontSize: '32px' })
      .setOrigin(0.5)
      .setDepth(this.telegraphDepth + 1)
      .setAlpha(0.95);

    const updatePositions = () => {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const dist = Math.min(range - 20, Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y));
      const cx = this.x + Math.cos(angle) * dist * 0.8;
      const cy = this.y + Math.sin(angle) * dist * 0.8;
      circle.setPosition(cx, cy);
      if (icon.active) icon.setPosition(cx, cy - 28);
    };

    updatePositions();

    this.scene.tweens.add({
      targets: circle,
      scale: { from: 0.3, to: 1 },
      alpha: { from: 0.85, to: 0 },
      ease: 'Back.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => circle.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.95, to: 0 },
      y: { from: icon.y, to: icon.y - 12 },
      scale: { from: 0.85, to: 1.2 },
      ease: 'Sine.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => icon.destroy(),
    });
  }

  private showRushTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    maxDistance: number,
    color: number,
    emoji: string,
    duration: number,
  ) {
    const thickness = 46;
    const rect = this.scene.add.rectangle(this.x, this.y, maxDistance, thickness, color, 0.18)
      .setDepth(this.telegraphDepth)
      .setOrigin(0, 0.5)
      .setScale(0.1, 1)
      .setAlpha(0.85);
    const icon = this.scene.add.text(this.x, this.y, emoji, { fontSize: '32px' })
      .setOrigin(0.5)
      .setDepth(this.telegraphDepth + 1)
      .setAlpha(0.95)
      .setScale(0.9);

    const updatePositions = () => {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const travel = Math.min(maxDistance, Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) + 120);
      rect.setPosition(this.x, this.y);
      rect.setRotation(angle);
      if (icon.active) icon.setPosition(this.x + Math.cos(angle) * travel, this.y + Math.sin(angle) * travel);
    };

    updatePositions();

    this.scene.tweens.add({
      targets: rect,
      scaleX: { from: 0.1, to: 1 },
      alpha: { from: 0.85, to: 0 },
      ease: 'Expo.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => rect.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.95, to: 0 },
      scale: { from: 0.9, to: 1.3 },
      ease: 'Sine.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => icon.destroy(),
    });
  }

  private showRoarTelegraph(range: number, color: number, emoji: string, duration: number) {
    const outer = this.scene.add.circle(this.x, this.y, range, color, 0.14)
      .setDepth(this.telegraphDepth)
      .setStrokeStyle(4, color, 0.9)
      .setAlpha(0.8)
      .setScale(0.4);
    const inner = this.scene.add.circle(this.x, this.y, range * 0.55, color, 0)
      .setDepth(this.telegraphDepth)
      .setStrokeStyle(2, color, 0.6)
      .setAlpha(0.7)
      .setScale(0.4);
    const icon = this.scene.add.text(this.x, this.y - range - 12, emoji, { fontSize: '32px' })
      .setOrigin(0.5)
      .setDepth(this.telegraphDepth + 1)
      .setAlpha(0.95);

    const updatePositions = () => {
      outer.setPosition(this.x, this.y);
      inner.setPosition(this.x, this.y);
      if (icon.active) icon.setPosition(this.x, this.y - range - 12);
    };

    updatePositions();

    this.scene.tweens.add({
      targets: [outer, inner],
      scale: { from: 0.4, to: 1 },
      alpha: { from: 0.8, to: 0 },
      ease: 'Cubic.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => { outer.destroy(); inner.destroy(); },
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.95, to: 0 },
      y: { from: icon.y, to: icon.y - 12 },
      scale: { from: 0.9, to: 1.25 },
      ease: 'Sine.easeOut',
      duration,
      onUpdate: updatePositions,
      onComplete: () => icon.destroy(),
    });
  }

  private spawnImpactEmoji(x: number, y: number, emoji: string, tint: number, duration = 420) {
    const icon = this.scene.add.text(x, y, emoji, { fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(this.telegraphDepth + 2);
    icon.setTint(tint);

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 1, to: 0 },
      y: y - 18,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  private enterCooldownPose(tint: number) {
    this.setTint(tint);
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: this.scaleX, to: 0.94 },
      scaleY: { from: this.scaleY, to: 1.06 },
      duration: 160,
      ease: 'Sine.easeOut',
    });
  }
}
