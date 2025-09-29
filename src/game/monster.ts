import Phaser from 'phaser';
const TELEGRAPH_COLORS = {
  preWarn: 0xffe066,
  windUp: 0xffa149,
  commit: 0xff5252,
  recovery: 0xb7b7b7,
};

type TelegraphTimings = {
  preWarn: number;
  windUp: number;
  commit: number;
  recovery: number;
};

type TelegraphHandle = {
  startPreWarn: () => void;
  startWindUp: () => void;
  startCommit: () => void;
  startRecovery: () => void;
};

export class Monster extends Phaser.Physics.Arcade.Sprite {
  hp = 12;
  private hpMax = this.hp;
  state: 'wander'|'chase'|'engage' = 'wander';
  actionT = { sweep: 2.5, smash: 4.0, rush: 5.0, roar: 7.0 };
  cd = { sweep: 0, smash: 0, rush: 0, roar: 0 };
  speed = 140;
  target?: Phaser.Types.Physics.Arcade.GameObjectWithBody;
  private baseTint = 0xffffff;
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

  private showSweepTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    range: number,
    timings: TelegraphTimings,
  ): TelegraphHandle {
    const spread = Phaser.Math.DegToRad(150);
    const baseDepth = Math.min(this.telegraphDepth, this.depth - 2);
    const outlineDepth = baseDepth + 6;
    const fill = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(baseDepth);
    const outline = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(outlineDepth);
    const state = {
      color: TELEGRAPH_COLORS.preWarn,
      fillAlpha: 0.4,
      strokeAlpha: 0.7,
      strokeWidth: 5,
    };
    let pulse: Phaser.Tweens.Tween | undefined;
    let updateHandler: (() => void) | undefined;

    const draw = () => {
      fill.clear();
      fill.fillStyle(state.color, state.fillAlpha);
      fill.beginPath();
      fill.moveTo(0, 0);
      fill.arc(0, 0, range, -spread / 2, spread / 2, false);
      fill.closePath();
      fill.fillPath();

      outline.clear();
      outline.lineStyle(state.strokeWidth, state.color, state.strokeAlpha);
      outline.beginPath();
      outline.arc(0, 0, range, -spread / 2, spread / 2, false);
      outline.strokePath();
    };

    const updatePositions = () => {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      fill.setPosition(this.x, this.y);
      outline.setPosition(this.x, this.y);
      fill.setRotation(angle);
      outline.setRotation(angle);
    };

    draw();
    updatePositions();

    updateHandler = () => updatePositions();
    this.scene.events.on('update', updateHandler);

    const stopPulse = () => {
      if (pulse) {
        pulse.stop();
        pulse = undefined;
      }
    };

    const cleanup = () => {
      stopPulse();
      if (updateHandler) {
        this.scene.events.off('update', updateHandler);
        updateHandler = undefined;
      }
      fill.destroy();
      outline.destroy();
    };

    return {
      startPreWarn: () => {
        stopPulse();
        state.color = TELEGRAPH_COLORS.preWarn;
        state.fillAlpha = 0.4;
        state.strokeAlpha = 0.7;
        state.strokeWidth = 5;
        draw();
      },
      startWindUp: () => {
        state.color = TELEGRAPH_COLORS.windUp;
        state.fillAlpha = 0.65;
        state.strokeAlpha = 0.95;
        state.strokeWidth = 7.5;
        draw();
        stopPulse();
        pulse = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 220,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          onUpdate: (tween) => {
            const t = tween.getValue();
            state.strokeWidth = Phaser.Math.Linear(7.5, 6.2, t);
            state.fillAlpha = Phaser.Math.Linear(0.65, 0.58, t);
            draw();
          },
        });
      },
      startCommit: () => {
        stopPulse();
        if (updateHandler) {
          this.scene.events.off('update', updateHandler);
          updateHandler = undefined;
        }
        state.color = TELEGRAPH_COLORS.commit;
        state.fillAlpha = 1;
        state.strokeAlpha = 1;
        state.strokeWidth = 8;
        draw();
        this.scene.tweens.add({
          targets: state,
          fillAlpha: 0.7,
          duration: 80,
          ease: 'Quad.easeOut',
          onUpdate: draw,
        });
      },
      startRecovery: () => {
        stopPulse();
        state.color = TELEGRAPH_COLORS.recovery;
        draw();
        this.scene.tweens.add({
          targets: state,
          fillAlpha: 0,
          strokeAlpha: 0,
          duration: 250,
          ease: 'Sine.easeIn',
          onUpdate: draw,
          onComplete: cleanup,
        });
      },
    };
  }

  private showSmashTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    range: number,
    timings: TelegraphTimings,
  ): TelegraphHandle {
    const baseDepth = Math.min(this.telegraphDepth, this.depth - 2);
    const fill = this.scene.add.circle(this.x, this.y, range, TELEGRAPH_COLORS.preWarn, 0.4)
      .setDepth(baseDepth)
      .setScale(0.75);
    const outline = this.scene.add.circle(this.x, this.y, range, TELEGRAPH_COLORS.preWarn, 0)
      .setDepth(baseDepth + 6)
      .setStrokeStyle(6, TELEGRAPH_COLORS.preWarn, 0.75)
      .setScale(0.75);
    const target = { scale: 0.75 };
    let pulse: Phaser.Tweens.Tween | undefined;
    let tracking = true;

    const updatePosition = () => {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const dist = Math.min(range, Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y));
      const cx = this.x + Math.cos(angle) * dist * 0.55;
      const cy = this.y + Math.sin(angle) * dist * 0.55;
      fill.setPosition(cx, cy);
      outline.setPosition(cx, cy);
      fill.setScale(target.scale);
      outline.setScale(target.scale);
    };

    const updateHandler = () => updatePosition();
    this.scene.events.on('update', updateHandler);

    const stopPulse = () => {
      if (pulse) {
        pulse.stop();
        pulse = undefined;
      }
    };

    const cleanup = () => {
      stopPulse();
      if (tracking) {
        this.scene.events.off('update', updateHandler);
      }
      fill.destroy();
      outline.destroy();
    };

    updatePosition();

    return {
      startPreWarn: () => {
        stopPulse();
        target.scale = 0.75;
        fill.setFillStyle(TELEGRAPH_COLORS.preWarn, 0.4);
        outline.setStrokeStyle(6, TELEGRAPH_COLORS.preWarn, 0.75);
        this.scene.tweens.add({
          targets: target,
          scale: 0.92,
          duration: timings.preWarn,
          ease: 'Sine.easeOut',
          onUpdate: updatePosition,
        });
      },
      startWindUp: () => {
        fill.setFillStyle(TELEGRAPH_COLORS.windUp, 0.65);
        outline.setStrokeStyle(9, TELEGRAPH_COLORS.windUp, 0.95);
        stopPulse();
        pulse = this.scene.tweens.add({
          targets: target,
          scale: { from: 1.02, to: 0.9 },
          duration: 220,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
          onUpdate: updatePosition,
        });
      },
      startCommit: () => {
        stopPulse();
        if (tracking) {
          this.scene.events.off('update', updateHandler);
          tracking = false;
        }
        fill.setFillStyle(TELEGRAPH_COLORS.commit, 0.95);
        outline.setStrokeStyle(10, TELEGRAPH_COLORS.commit, 1);
        fill.setAlpha(1);
        outline.setAlpha(1);
        updatePosition();
        this.scene.tweens.add({
          targets: [fill, outline],
          alpha: { from: 1, to: 0.7 },
          duration: 80,
          ease: 'Quad.easeOut',
        });
      },
      startRecovery: () => {
        stopPulse();
        fill.setFillStyle(TELEGRAPH_COLORS.recovery, 0.6);
        outline.setStrokeStyle(8, TELEGRAPH_COLORS.recovery, 0.8);
        fill.setAlpha(0.7);
        outline.setAlpha(0.7);
        this.scene.tweens.add({
          targets: [fill, outline],
          alpha: { from: 0.7, to: 0 },
          duration: 250,
          ease: 'Sine.easeIn',
          onComplete: cleanup,
        });
      },
    };
  }

  private showRushTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    maxDistance: number,
    timings: TelegraphTimings,
  ): TelegraphHandle {
    const halfThickness = 26;
    const baseDepth = Math.min(this.telegraphDepth, this.depth - 2);
    const outlineDepth = baseDepth + 6;
    const fill = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(baseDepth);
    const outline = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(outlineDepth);
    const state = {
      color: TELEGRAPH_COLORS.preWarn,
      fillAlpha: 0.4,
      strokeAlpha: 0.75,
      strokeWidth: 5,
      length: Math.max(140, maxDistance * 0.45),
    };
    let pulse: Phaser.Tweens.Tween | undefined;
    let updateHandler: (() => void) | undefined;

    const draw = () => {
      fill.clear();
      fill.fillStyle(state.color, state.fillAlpha);
      fill.fillRoundedRect(0, -halfThickness, state.length, halfThickness * 2, halfThickness);
      outline.clear();
      outline.lineStyle(state.strokeWidth, state.color, state.strokeAlpha);
      outline.strokeRoundedRect(0, -halfThickness, state.length, halfThickness * 2, halfThickness);
    };

    const updatePositions = () => {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const travel = Math.min(maxDistance, Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) + 120);
      state.length = travel;
      draw();
      fill.setPosition(this.x, this.y);
      outline.setPosition(this.x, this.y);
      fill.setRotation(angle);
      outline.setRotation(angle);
    };

    draw();
    updatePositions();

    updateHandler = () => updatePositions();
    this.scene.events.on('update', updateHandler);

    const stopPulse = () => {
      if (pulse) {
        pulse.stop();
        pulse = undefined;
      }
    };

    const cleanup = () => {
      stopPulse();
      if (updateHandler) {
        this.scene.events.off('update', updateHandler);
        updateHandler = undefined;
      }
      fill.destroy();
      outline.destroy();
    };

    return {
      startPreWarn: () => {
        stopPulse();
        state.color = TELEGRAPH_COLORS.preWarn;
        state.fillAlpha = 0.4;
        state.strokeAlpha = 0.75;
        state.strokeWidth = 5;
        draw();
      },
      startWindUp: () => {
        state.color = TELEGRAPH_COLORS.windUp;
        state.fillAlpha = 0.65;
        state.strokeAlpha = 0.95;
        state.strokeWidth = 7;
        draw();
        stopPulse();
        pulse = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 200,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
          onUpdate: (tween) => {
            const t = tween.getValue();
            state.fillAlpha = Phaser.Math.Linear(0.7, 0.6, t);
            state.strokeWidth = Phaser.Math.Linear(7.5, 6.4, t);
            draw();
          },
        });
      },
      startCommit: () => {
        stopPulse();
        if (updateHandler) {
          this.scene.events.off('update', updateHandler);
          updateHandler = undefined;
        }
        state.color = TELEGRAPH_COLORS.commit;
        state.fillAlpha = 0.95;
        state.strokeAlpha = 1;
        state.strokeWidth = 8;
        draw();
        this.scene.tweens.add({
          targets: state,
          fillAlpha: 0.72,
          duration: 80,
          ease: 'Quad.easeOut',
          onUpdate: draw,
        });
      },
      startRecovery: () => {
        stopPulse();
        state.color = TELEGRAPH_COLORS.recovery;
        draw();
        this.scene.tweens.add({
          targets: state,
          fillAlpha: 0,
          strokeAlpha: 0,
          duration: 250,
          ease: 'Sine.easeIn',
          onUpdate: draw,
          onComplete: cleanup,
        });
      },
    };
  }

  private showRoarTelegraph(range: number, timings: TelegraphTimings): TelegraphHandle {
    const baseDepth = Math.min(this.telegraphDepth, this.depth - 2);
    const ring = this.scene.add.circle(this.x, this.y, range, TELEGRAPH_COLORS.preWarn, 0)
      .setDepth(baseDepth)
      .setStrokeStyle(14, TELEGRAPH_COLORS.preWarn, 0.45)
      .setScale(0.96);
    const outerEdge = this.scene.add.circle(this.x, this.y, range, TELEGRAPH_COLORS.preWarn, 0)
      .setDepth(baseDepth + 6)
      .setStrokeStyle(6, TELEGRAPH_COLORS.preWarn, 0.9)
      .setScale(0.96);
    const innerEdge = this.scene.add.circle(this.x, this.y, range * 0.55, TELEGRAPH_COLORS.preWarn, 0)
      .setDepth(baseDepth + 7)
      .setStrokeStyle(3, TELEGRAPH_COLORS.preWarn, 0.8)
      .setScale(0.96);
    let pulse: Phaser.Tweens.Tween | undefined;
    let tracking = true;

    const updatePositions = () => {
      ring.setPosition(this.x, this.y);
      outerEdge.setPosition(this.x, this.y);
      innerEdge.setPosition(this.x, this.y);
    };

    const updateHandler = () => updatePositions();
    this.scene.events.on('update', updateHandler);

    const stopPulse = () => {
      if (pulse) {
        pulse.stop();
        pulse = undefined;
      }
    };

    const cleanup = () => {
      stopPulse();
      if (tracking) {
        this.scene.events.off('update', updateHandler);
        tracking = false;
      }
      ring.destroy();
      outerEdge.destroy();
      innerEdge.destroy();
    };

    updatePositions();

    return {
      startPreWarn: () => {
        stopPulse();
        ring.setStrokeStyle(14, TELEGRAPH_COLORS.preWarn, 0.45);
        outerEdge.setStrokeStyle(6, TELEGRAPH_COLORS.preWarn, 0.9);
        innerEdge.setStrokeStyle(3, TELEGRAPH_COLORS.preWarn, 0.8);
        ring.setAlpha(1);
        outerEdge.setAlpha(1);
        innerEdge.setAlpha(0.85);
        ring.setScale(0.94);
        outerEdge.setScale(0.94);
        innerEdge.setScale(0.94);
      },
      startWindUp: () => {
        ring.setStrokeStyle(14, TELEGRAPH_COLORS.windUp, 0.55);
        outerEdge.setStrokeStyle(6, TELEGRAPH_COLORS.windUp, 0.95);
        innerEdge.setStrokeStyle(3, TELEGRAPH_COLORS.windUp, 0.85);
        stopPulse();
        pulse = this.scene.tweens.add({
          targets: [ring, outerEdge, innerEdge],
          scale: { from: 1.03, to: 0.97 },
          duration: 220,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      },
      startCommit: () => {
        stopPulse();
        if (tracking) {
          this.scene.events.off('update', updateHandler);
          tracking = false;
        }
        ring.setStrokeStyle(14, TELEGRAPH_COLORS.commit, 0.95);
        outerEdge.setStrokeStyle(6, TELEGRAPH_COLORS.commit, 1);
        innerEdge.setStrokeStyle(3, TELEGRAPH_COLORS.commit, 0.95);
        ring.setAlpha(1);
        outerEdge.setAlpha(1);
        innerEdge.setAlpha(1);
        this.scene.tweens.add({
          targets: [ring, outerEdge, innerEdge],
          alpha: { from: 1, to: 0.72 },
          duration: 80,
          ease: 'Quad.easeOut',
        });
      },
      startRecovery: () => {
        stopPulse();
        ring.setStrokeStyle(14, TELEGRAPH_COLORS.recovery, 0.6);
        outerEdge.setStrokeStyle(6, TELEGRAPH_COLORS.recovery, 0.8);
        innerEdge.setStrokeStyle(3, TELEGRAPH_COLORS.recovery, 0.7);
        ring.setAlpha(0.72);
        outerEdge.setAlpha(0.72);
        innerEdge.setAlpha(0.7);
        this.scene.tweens.add({
          targets: [ring, outerEdge, innerEdge],
          alpha: { from: 0.72, to: 0 },
          duration: 250,
          ease: 'Sine.easeIn',
          onComplete: cleanup,
        });
      },
    };
  }




  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'monster', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(0.45);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(30, 34, 54);
    this.setCollideWorldBounds(true);
    this.anims.play('monster-idle');
    this.baseScale = { x: this.scaleX, y: this.scaleY };

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
      scaleX: { from: this.baseScale.x, to: this.baseScale.x * 1.04 },
      scaleY: { from: this.baseScale.y, to: this.baseScale.y * 0.96 },
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

    if (!this.actionLock && this.body) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const moving = body.deltaAbsX() > 0.5 || body.deltaAbsY() > 0.5;
      this.anims.play(moving ? 'monster-walk' : 'monster-idle', true);
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
    this.anims.stop();

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
    this.anims.play('monster-idle', true);
  }

  sweep(player: Phaser.Physics.Arcade.Sprite) {
    const timings: TelegraphTimings = { preWarn: 280, windUp: 360, commit: 220, recovery: 420 };
    let telegraph: TelegraphHandle | undefined;
    this.startAction({
      telegraph: [
        {
          duration: timings.preWarn,
          scaleX: 0.92,
          scaleY: 1.12,
          angle: -14,
          ease: 'Sine.easeOut',
          onStart: () => {
            this.setTint(TELEGRAPH_COLORS.preWarn);
            telegraph = this.showSweepTelegraph(player, 120, timings);
            telegraph.startPreWarn();
            this.spawnImpactEmoji(this.x, this.y - 36, '🌀', 0xffe6b3, timings.preWarn + timings.windUp);
          },

        },
        {
          duration: timings.windUp,
          scaleX: 0.84,
          scaleY: 1.2,
          angle: -22,
          ease: 'Sine.easeIn',
          onStart: () => {
            this.setTint(TELEGRAPH_COLORS.windUp);
            telegraph?.startWindUp();
          },
        },
      ],
      attack: [
        {
          duration: timings.commit,
          scaleX: 1.36,
          scaleY: 0.74,
          angle: 24,
          ease: 'Back.easeOut',
          onStart: () => {
            telegraph?.startCommit();
            if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 80) {
              player.emit('hit', { dmg: 1, type: 'sweep' });
              this.spawnImpactEmoji(player.x, player.y - 20, '💫', 0xffd18a);
            }
          },
          onComplete: () => telegraph?.startRecovery(),
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
        duration: timings.recovery,
        onStart: () => this.enterCooldownPose(0xffa95a),
      },
    });
  }
  smash(player: Phaser.Physics.Arcade.Sprite) {
    const timings: TelegraphTimings = { preWarn: 260, windUp: 360, commit: 220, recovery: 520 };
    let telegraph: TelegraphHandle | undefined;
    this.startAction({
      telegraph: [
        {
          duration: timings.preWarn,
          scaleX: 1.04,
          scaleY: 0.96,
          ease: 'Quad.easeOut',
          onStart: () => {
            this.setTint(TELEGRAPH_COLORS.preWarn);
            telegraph = this.showSmashTelegraph(player, 130, timings);
            telegraph.startPreWarn();
            this.spawnImpactEmoji(this.x, this.y - 44, '💢', 0xfff2c6, timings.preWarn + timings.windUp);
          },
        },
        {
          duration: timings.windUp,
          scaleX: 0.82,
          scaleY: 1.22,
          ease: 'Quad.easeIn',
          onStart: () => {
            this.setTint(TELEGRAPH_COLORS.windUp);
            telegraph?.startWindUp();
          },

        },
      ],
      attack: [
        {
          duration: timings.commit,
          scaleX: 1.42,
          scaleY: 0.7,
          ease: 'Bounce.easeOut',
          onStart: () => {
            telegraph?.startCommit();
            if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 120) {
              player.emit('hit', { dmg: 1, type: 'smash' });
              this.spawnImpactEmoji(player.x, player.y - 26, '💥', 0xfff2c6);
            }
          },
          onComplete: () => telegraph?.startRecovery(),
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
        duration: timings.recovery,
        onStart: () => this.enterCooldownPose(0xffb067),
      },
    });
  }
  rush(player: Phaser.Physics.Arcade.Sprite) {
    const timings: TelegraphTimings = { preWarn: 260, windUp: 360, commit: 260, recovery: 460 };
    let telegraph: TelegraphHandle | undefined;
    this.startAction({
      telegraph: [
        {
          duration: timings.preWarn,
          scaleX: 0.92,
          scaleY: 1.12,
          ease: 'Quad.easeOut',
          onStart: () => {
            this.setTint(TELEGRAPH_COLORS.preWarn);
            telegraph = this.showRushTelegraph(player, 280, timings);
            telegraph.startPreWarn();
            this.spawnImpactEmoji(this.x, this.y - 34, '👣', 0xffe6bb, timings.preWarn + timings.windUp);
          },
        },
        {
          duration: timings.windUp,
          scaleX: 1.04,
          scaleY: 0.94,
          ease: 'Sine.easeInOut',
          onStart: () => {
            this.setTint(TELEGRAPH_COLORS.windUp);
            telegraph?.startWindUp();
          },
        },
      ],
      attack: [
        {
          duration: timings.commit,
          scaleX: 1.48,
          scaleY: 0.72,
          ease: 'Expo.easeOut',
          onStart: () => {
            telegraph?.startCommit();
            const v = this.scene.physics.velocityFromRotation(
              Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y), 340);
            this.setVelocity(v.x, v.y);
          },
          onComplete: () => {
            telegraph?.startRecovery();
            this.scene.time.delayedCall(80, () => this.setVelocity(0, 0));
            this.spawnImpactEmoji(this.x, this.y - 28, '💢', 0xffe0b3);
          },
        },
        {
          duration: 220,
          scaleX: this.baseScale.x,
          scaleY: this.baseScale.y,
          ease: 'Quad.easeOut',
        },
      ],
      cooldown: {
        duration: timings.recovery,
        onStart: () => this.enterCooldownPose(0xeeaa55),
      },
    });
  }
  roar(player: Phaser.Physics.Arcade.Sprite) {
    const timings: TelegraphTimings = { preWarn: 300, windUp: 360, commit: 200, recovery: 360 };
    let telegraph: TelegraphHandle | undefined;
    this.startAction({
      telegraph: [
        {
          duration: timings.preWarn,
          scaleX: 0.98,
          scaleY: 1.08,
          ease: 'Sine.easeInOut',
          onStart: () => {
            this.setTintFill(TELEGRAPH_COLORS.preWarn);
            telegraph = this.showRoarTelegraph(190, timings);
            telegraph.startPreWarn();
            this.spawnImpactEmoji(this.x, this.y - 48, '😤', 0xfff2c6, timings.preWarn + timings.windUp);
          },
        },
        {
          duration: timings.windUp,
          scaleX: 1.08,
          scaleY: 1.12,
          ease: 'Sine.easeIn',
          onStart: () => {
            this.setTint(TELEGRAPH_COLORS.windUp);
            telegraph?.startWindUp();
          },
        },
      ],
      attack: [
        {
          duration: timings.commit,
          scaleX: 1.18,
          scaleY: 1.18,
          ease: 'Sine.easeOut',
          onStart: () => {
            telegraph?.startCommit();
            player.emit('hit', { dmg: 0, type: 'roar' });
            this.spawnImpactEmoji(player.x, player.y - 34, '😱', 0xfff2c6);
          },
          onComplete: () => telegraph?.startRecovery(),
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
        duration: timings.recovery,
        onStart: () => this.enterCooldownPose(this.baseTint),
      },
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
