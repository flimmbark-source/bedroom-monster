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

type TelegraphPhase = 'preWarn' | 'windUp' | 'commit' | 'recovery' | 'done';

type AttackType = 'sweep' | 'smash' | 'rush' | 'roar';

type AttackPriority = 'rush' | 'smash' | 'sweep' | 'roar';

const PRIORITY_VALUE: Record<AttackPriority, number> = {
  rush: 3,
  smash: 2,
  sweep: 1,
  roar: 0,
};

export type TelegraphImpact = {
  type: AttackType;
  damage: number;
  slowMultiplier?: number;
  slowDuration?: number;
  knockback?: number;
  screenShake?: { duration: number; intensity: number };
};

export type MonsterHitboxDefinition = {
  id: string;
  part: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  damageMultiplier?: number;
};

export type MonsterHitbox = MonsterHitboxDefinition & {
  rect: Phaser.Geom.Rectangle;
  damageMultiplier: number;
};

type ActiveTelegraph = {
  id: string;
  type: AttackType;
  priority: AttackPriority;
  phase: TelegraphPhase;
  timings: TelegraphTimings;
  hasHitPlayer: boolean;
  containsPoint: (x: number, y: number) => boolean;
  impact: TelegraphImpact;
  setPhase: (phase: TelegraphPhase) => void;
  destroy: () => void;
};

type TelegraphHandle = {
  startPreWarn: () => void;
  startWindUp: () => void;
  startCommit: () => void;
  startRecovery: () => void;
  destroy: () => void;
  telegraph: ActiveTelegraph;
};

export type TelegraphHitCandidate = {
  id: string;
  priority: AttackPriority;
  impact: TelegraphImpact;
};

export class Monster extends Phaser.Physics.Arcade.Sprite {
  private hpMax = 12;
  hp = this.hpMax;
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
  private activeTelegraphs = new Map<string, ActiveTelegraph>();
  private telegraphSeq = 0;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private hpBarWidth = 52;
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';
  private pushSlowTimer = 0;
  private hitboxDefs: MonsterHitboxDefinition[] = [
    {
      id: 'core',
      part: 'core',
      width: 96,
      height: 158,
      offsetX: 0,
      offsetY: 12,
      damageMultiplier: 1,
    },
  ];


  override setVelocity(x?: number, y?: number): this {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) {
      return this;
    }
    body.setVelocity(x ?? 0, typeof y === 'number' ? y : undefined);
    return this;
  }


  setDepth(value: number): this {
    super.setDepth(value);
    if (this.hpBarBg) this.hpBarBg.setDepth(value + 3);
    if (this.hpBarFill) this.hpBarFill.setDepth(value + 4);
    return this;
  }

  private movementAnimKey(moving: boolean) {
    return `monster-${moving ? 'walk' : 'idle'}-${this.facing}` as const;
  }

  private setFacingFromVector(dx: number, dy: number) {
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }
  }

  private updateFacingFromVelocity() {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    this.setFacingFromVector(body.velocity.x, body.velocity.y);
  }

  private playMovementAnimation(moving: boolean) {
    this.anims.play(this.movementAnimKey(moving), true);
  }

  private registerTelegraph(
    type: AttackType,
    priority: AttackPriority,
    timings: TelegraphTimings,
    containsPoint: (x: number, y: number) => boolean,
    impact: TelegraphImpact,
    cleanup: () => void,
  ): ActiveTelegraph {
    const id = `${type}-${++this.telegraphSeq}`;
    const telegraph: ActiveTelegraph = {
      id,
      type,
      priority,
      phase: 'preWarn',
      timings,
      hasHitPlayer: false,
      containsPoint,
      impact,
      setPhase: (phase: TelegraphPhase) => {
        telegraph.phase = phase;
        if (phase === 'commit') {
          telegraph.hasHitPlayer = false;
        }
        if (phase === 'done') {
          this.activeTelegraphs.delete(id);
        }
      },
      destroy: () => {
        telegraph.setPhase('done');
        cleanup();
      },
    };
    this.activeTelegraphs.set(id, telegraph);
    return telegraph;
  }

  getTelegraphHitCandidates(playerHitboxes: Phaser.Geom.Rectangle[]): TelegraphHitCandidate[] {
    const results: TelegraphHitCandidate[] = [];
    this.activeTelegraphs.forEach((telegraph) => {
      if (telegraph.phase !== 'commit' || telegraph.hasHitPlayer) return;
      const hit = playerHitboxes.some((rect) => {
        const corners = [
          { x: rect.left, y: rect.top },
          { x: rect.right, y: rect.top },
          { x: rect.right, y: rect.bottom },
          { x: rect.left, y: rect.bottom },
        ];
        if (corners.some((corner) => telegraph.containsPoint(corner.x, corner.y))) {
          return true;
        }
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        if (telegraph.containsPoint(centerX, centerY)) {
          return true;
        }
        return false;
      });
      if (!hit) return;
      results.push({
        id: telegraph.id,
        priority: telegraph.priority,
        impact: telegraph.impact,
      });
    });
    return results;
  }

  getHitboxes(): MonsterHitbox[] {
    const scaleX = Math.abs(this.scaleX) || 1;
    const scaleY = Math.abs(this.scaleY) || 1;
    return this.hitboxDefs.map((def) => {
      const width = def.width * scaleX;
      const height = def.height * scaleY;
      const x = this.x + def.offsetX * this.scaleX;
      const y = this.y + def.offsetY * this.scaleY;
      const rect = new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height);
      return {
        ...def,
        rect,
        damageMultiplier: def.damageMultiplier ?? 1,
      };
    });
  }

  resolveTelegraphHit(id: string) {
    const telegraph = this.activeTelegraphs.get(id);
    if (telegraph) {
      telegraph.hasHitPlayer = true;
    }
  }

  resolveTelegraphHits(ids: string[]) {
    ids.forEach((id) => this.resolveTelegraphHit(id));
  }

  private showSweepTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    range: number,
    timings: TelegraphTimings,
  ): TelegraphHandle {
    const spread = Phaser.Math.DegToRad(120);
    const halfSpread = spread / 2;
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
    let lockedAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    let trackingRotation = true;
    let pulse: Phaser.Tweens.Tween | undefined;
    let updateHandler: (() => void) | undefined;

    const draw = () => {
      fill.clear();
      fill.fillStyle(state.color, state.fillAlpha);
      fill.beginPath();
      fill.moveTo(0, 0);
      fill.arc(0, 0, range, -halfSpread, halfSpread, false);
      fill.closePath();
      fill.fillPath();

      outline.clear();
      outline.lineStyle(state.strokeWidth, state.color, state.strokeAlpha);
      outline.beginPath();
      outline.arc(0, 0, range, -halfSpread, halfSpread, false);
      outline.strokePath();
    };

    const containsPoint = (px: number, py: number) => {
      const dx = px - this.x;
      const dy = py - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range) return false;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(angle - lockedAngle));
      return diff <= halfSpread;
    };

    const updatePositions = () => {
      if (trackingRotation) {
        lockedAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      }
      fill.setPosition(this.x, this.y);
      outline.setPosition(this.x, this.y);
      fill.setRotation(lockedAngle);
      outline.setRotation(lockedAngle);
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

    const telegraph = this.registerTelegraph(
      'sweep',
      'sweep',
      timings,
      containsPoint,
      {
        type: 'sweep',
        damage: 1,
        knockback: 90,
        screenShake: { duration: 80, intensity: 0.004 },
      },
      cleanup,
    );

    return {
      telegraph,
      destroy: () => telegraph.destroy(),
      startPreWarn: () => {
        telegraph.setPhase('preWarn');
        stopPulse();
        state.color = TELEGRAPH_COLORS.preWarn;
        state.fillAlpha = 0.4;
        state.strokeAlpha = 0.7;
        state.strokeWidth = 5;
        draw();
      },
      startWindUp: () => {
        telegraph.setPhase('windUp');
        trackingRotation = false;
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
        telegraph.setPhase('commit');
        stopPulse();
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
        telegraph.setPhase('recovery');
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
          onComplete: () => telegraph.destroy(),
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
    let lockedCenter = new Phaser.Math.Vector2(this.x, this.y);

    const updatePosition = () => {
      if (tracking) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const dist = Math.min(range, Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y));
        lockedCenter = new Phaser.Math.Vector2(
          this.x + Math.cos(angle) * dist * 0.55,
          this.y + Math.sin(angle) * dist * 0.55,
        );
      }
      fill.setPosition(lockedCenter.x, lockedCenter.y);
      outline.setPosition(lockedCenter.x, lockedCenter.y);
      fill.setScale(target.scale);
      outline.setScale(target.scale);
    };

    const containsPoint = (px: number, py: number) => {
      const dx = px - lockedCenter.x;
      const dy = py - lockedCenter.y;
      return dx * dx + dy * dy <= range * range;
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
      this.scene.events.off('update', updateHandler);
      fill.destroy();
      outline.destroy();
    };

    updatePosition();

    const telegraph = this.registerTelegraph(
      'smash',
      'smash',
      timings,
      containsPoint,
      {
        type: 'smash',
        damage: 1,
        screenShake: { duration: 110, intensity: 0.008 },
      },
      cleanup,
    );

    return {
      telegraph,
      destroy: () => telegraph.destroy(),
      startPreWarn: () => {
        telegraph.setPhase('preWarn');
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
        telegraph.setPhase('windUp');
        tracking = false;
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
        telegraph.setPhase('commit');
        stopPulse();
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
        telegraph.setPhase('recovery');
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
          onComplete: () => telegraph.destroy(),
        });
      },
    };
  }

  private showRushTelegraph(
    player: Phaser.Physics.Arcade.Sprite,
    maxDistance: number,
    timings: TelegraphTimings,
  ): TelegraphHandle {
    const halfThickness = 32;
    const baseDepth = Math.min(this.telegraphDepth, this.depth - 2);
    const outlineDepth = baseDepth + 6;
    const fill = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(baseDepth);
    const outline = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(outlineDepth);
    const state = {
      color: TELEGRAPH_COLORS.preWarn,
      fillAlpha: 0.4,
      strokeAlpha: 0.75,
      strokeWidth: 5,
      length: Math.max(300, maxDistance * 0.55),
    };
    let pulse: Phaser.Tweens.Tween | undefined;
    let updateHandler: (() => void) | undefined;
    let lockedAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    let lockedLength = state.length;
    let origin = new Phaser.Math.Vector2(this.x, this.y);
    let tracking = true;

    const draw = () => {
      fill.clear();
      fill.fillStyle(state.color, state.fillAlpha);
      fill.fillRoundedRect(0, -halfThickness, state.length, halfThickness * 2, halfThickness);
      outline.clear();
      outline.lineStyle(state.strokeWidth, state.color, state.strokeAlpha);
      outline.strokeRoundedRect(0, -halfThickness, state.length, halfThickness * 2, halfThickness);
    };

    const updatePositions = () => {
      if (tracking) {
        lockedAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        lockedLength = Phaser.Math.Clamp(dist + 160, 300, 420);
        state.length = lockedLength;
        origin = new Phaser.Math.Vector2(this.x, this.y);
      } else {
        state.length = lockedLength;
      }
      draw();
      fill.setPosition(origin.x, origin.y);
      outline.setPosition(origin.x, origin.y);
      fill.setRotation(lockedAngle);
      outline.setRotation(lockedAngle);
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

    const containsPoint = (px: number, py: number) => {
      const dx = px - origin.x;
      const dy = py - origin.y;
      const cos = Math.cos(lockedAngle);
      const sin = Math.sin(lockedAngle);
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;
      return localX >= 0 && localX <= lockedLength && Math.abs(localY) <= halfThickness;
    };

    const telegraph = this.registerTelegraph(
      'rush',
      'rush',
      timings,
      containsPoint,
      {
        type: 'rush',
        damage: 1,
        screenShake: { duration: 90, intensity: 0.008 },
      },
      cleanup,
    );

    return {
      telegraph,
      destroy: () => telegraph.destroy(),
      startPreWarn: () => {
        telegraph.setPhase('preWarn');
        stopPulse();
        state.color = TELEGRAPH_COLORS.preWarn;
        state.fillAlpha = 0.4;
        state.strokeAlpha = 0.75;
        state.strokeWidth = 5;
        draw();
      },
      startWindUp: () => {
        telegraph.setPhase('windUp');
        tracking = false;
        origin = new Phaser.Math.Vector2(this.x, this.y);
        lockedLength = state.length;
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
            state.strokeWidth = Phaser.Math.Linear(7.5, 6.4, t);
            state.fillAlpha = Phaser.Math.Linear(0.65, 0.58, t);
            draw();
          },
        });
      },
      startCommit: () => {
        telegraph.setPhase('commit');
        stopPulse();
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
        const v = this.scene.physics.velocityFromRotation(lockedAngle, 340);
        this.setVelocity(v.x, v.y);
      },
      startRecovery: () => {
        telegraph.setPhase('recovery');
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
          onComplete: () => telegraph.destroy(),
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
      this.scene.events.off('update', updateHandler);
      ring.destroy();
      outerEdge.destroy();
      innerEdge.destroy();
    };

    updatePositions();

    const containsPoint = (px: number, py: number) => {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, px, py);
      return dist <= range;
    };

    const telegraph = this.registerTelegraph(
      'roar',
      'roar',
      timings,
      containsPoint,
      {
        type: 'roar',
        damage: 0,
        slowMultiplier: 0.8,
        slowDuration: 1500,
      },
      cleanup,
    );

    return {
      telegraph,
      destroy: () => telegraph.destroy(),
      startPreWarn: () => {
        telegraph.setPhase('preWarn');
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
        telegraph.setPhase('windUp');
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
        telegraph.setPhase('commit');
        stopPulse();
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
        telegraph.setPhase('recovery');
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
          onComplete: () => telegraph.destroy(),
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
    const monsterBodyWidth = Math.abs(this.displayWidth) || Math.abs(this.width);
    const monsterBodyHeight = Math.abs(this.displayHeight) || Math.abs(this.height);
    body.setSize(monsterBodyWidth, monsterBodyHeight, true);
    this.setCollideWorldBounds(true);
    this.playMovementAnimation(false);
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
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) {
      return;
    }

    this.pushSlowTimer = Math.max(0, this.pushSlowTimer - dt);
    const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    this.state = d > 300 ? 'wander' : d > 140 ? 'chase' : 'engage';

    const pushSlowFactor = this.pushSlowTimer > 0 ? 0.55 : 1;

    // cooldowns
    for (const k in this.cd) (this.cd as any)[k] = Math.max(0, (this.cd as any)[k] - dt);

    // maintain a gentle sway while walking unless a telegraph is running.
    if (!this.actionLock) {
      const speed = body.velocity.length() || 0;
      if (speed > 40) {
        this.idleTween?.pause();
        this.setScale(1.05, 0.95);
      } else if (!this.currentChain) {
        this.resetPose();
        this.idleTween?.resume();
      }
    }

    if (!this.actionLock) {
      const moving = body.deltaAbsX() > 0.5 || body.deltaAbsY() > 0.5;
      if (moving) {
        this.updateFacingFromVelocity();
      } else if (player) {
        this.setFacingFromVector(player.x - this.x, player.y - this.y);
      }
      this.playMovementAnimation(moving);
    }

    if (this.actionLock) return;

    // simple steering
    if (this.state === 'wander') {
      this.moveToward(player, this.speed * 0.6 * pushSlowFactor);
    } else if (this.state === 'chase') {
      this.moveToward(player, this.speed * 1.0 * pushSlowFactor);
    } else {
      this.moveToward(player, this.speed * 1.1 * pushSlowFactor);
      // pick an action; each handler manages its telegraph and cooldown timing
      if (this.cd.sweep === 0) { this.sweep(player); this.cd.sweep = this.actionT.sweep; }
      else if (this.cd.smash === 0) { this.smash(player); this.cd.smash = this.actionT.smash; }
      else if (this.cd.rush === 0) { this.rush(player); this.cd.rush = this.actionT.rush; }
      else if (this.cd.roar === 0) { this.roar(player); this.cd.roar = this.actionT.roar; }
    }
  }

  private moveToward(target: Phaser.Math.Vector2Like, speed: number) {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    const direction = new Phaser.Math.Vector2(target.x - this.x, target.y - this.y);

    if (direction.lengthSq() < 1) {
      this.setVelocity(0, 0);
      return;
    }

    direction.normalize().scale(speed);
    this.setVelocity(direction.x, direction.y);
  }

  getPushIntent() {
    return this.lastMoveIntent.clone();
  }

  override setVelocity(x = 0, y = 0) {
    super.setVelocity(x, y);
    if (x === 0 && y === 0) {
      this.lastMoveIntent.set(0, 0);
    } else {
      this.lastMoveIntent.set(x, y);
    }
    return this;
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
    this.activeTelegraphs.forEach((telegraph) => telegraph.destroy());
    this.activeTelegraphs.clear();
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
    this.playMovementAnimation(false);
  }

  applyPushSlow(duration = 0.3) {
    this.pushSlowTimer = Math.max(this.pushSlowTimer, duration);
  }

  sweep(player: Phaser.Physics.Arcade.Sprite) {
    const timings: TelegraphTimings = { preWarn: 250, windUp: 350, commit: 200, recovery: 400 };
    let telegraph: TelegraphHandle | undefined;
    const sweepRange = 120;
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
            telegraph = this.showSweepTelegraph(player, sweepRange, timings);
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
            const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const impactRadius = sweepRange * 0.85;
            this.spawnImpactEmoji(
              this.x + Math.cos(angleToPlayer) * impactRadius,
              this.y - 20,
              '💫',
              0xffd18a,
              timings.commit,
            );
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
    const timings: TelegraphTimings = { preWarn: 300, windUp: 450, commit: 180, recovery: 450 };
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
            telegraph = this.showSmashTelegraph(player, 100, timings);
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
    const timings: TelegraphTimings = { preWarn: 300, windUp: 400, commit: 300, recovery: 500 };
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
            telegraph = this.showRushTelegraph(player, 420, timings);
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
            this.spawnImpactEmoji(this.x, this.y - 28, '💢', 0xffe0b3, timings.commit);
          },
          onComplete: () => {
            telegraph?.startRecovery();
            this.scene.time.delayedCall(100, () => this.setVelocity(0, 0));
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
    const timings: TelegraphTimings = { preWarn: 250, windUp: 350, commit: 150, recovery: 350 };
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
            telegraph = this.showRoarTelegraph(250, timings);
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
            this.spawnImpactEmoji(player.x, player.y - 34, '😱', 0xfff2c6, timings.commit);
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
