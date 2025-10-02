import Phaser from 'phaser';

import {
  Monster,
  type MonsterHitbox,
  type TelegraphHitCandidate,
  type TelegraphImpact,
} from '@game/monster';

import type { SpawnEmojiFn } from './SearchSystem';
import { InputSystem } from './InputSystem';
import { HitboxManager } from '../combat/hitboxManager';

export type MonsterDamageEvent = {
  damage: number;
  isDot: boolean;
};

export class TelegraphSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Arcade.Sprite,
    private readonly monster: Monster,
    private readonly hitboxManager: HitboxManager,
    private readonly input: InputSystem,
    private readonly fxDepth: number,
    private readonly spawnFloatingEmoji: SpawnEmojiFn,
    private readonly onMonsterDefeated: () => void,
    private readonly onMonsterDamaged?: (event: MonsterDamageEvent) => void,
  ) {}

  getAimAngle() {
    return this.input.getAimAngle();
  }

  getPlayerHitboxes() {
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) {
      const width = this.player.displayWidth;
      const height = this.player.displayHeight;
      return [
        new Phaser.Geom.Rectangle(
          this.player.x - width / 2,
          this.player.y - height / 2,
          width,
          height,
        ),
      ];
    }
    return [new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height)];
  }

  resolveTelegraphCollisions(
    now: number,
    currentIFrameUntil: number,
    onImpact: (impact: TelegraphImpact) => void,
  ) {
    const candidates = this.monster.getTelegraphHitCandidates(this.getPlayerHitboxes());
    if (!candidates.length) return currentIFrameUntil;

    const priority: Record<TelegraphHitCandidate['priority'], number> = {
      rush: 3,
      smash: 2,
      sweep: 1,
      roar: 0,
    };

    candidates.sort((a, b) => priority[b.priority] - priority[a.priority]);

    if (now >= currentIFrameUntil) {
      onImpact(candidates[0].impact);
      currentIFrameUntil = now + 150;
    }

    this.monster.resolveTelegraphHits(candidates.map((candidate) => candidate.id));
    return currentIFrameUntil;
  }

  getMonsterHitboxes() {
    return this.hitboxManager
      .getHurtboxes('monsters')
      .map((entry) => entry.data)
      .filter((data): data is MonsterHitbox => Boolean(data));
  }

  getMonsterHitboxesWithinArc(range: number, halfAngle: number) {
    const aim = this.getAimAngle();
    const originX = this.player.x;
    const originY = this.player.y;
    return this.getMonsterHitboxes().filter((hitbox) =>
      this.shapeIntersectsSector(hitbox.shape, originX, originY, range, aim, halfAngle),
    );
  }

  getMonsterHitboxesWithinStrip(range: number, halfAngle: number, halfThickness: number) {
    const aim = this.getAimAngle();
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y);
    return this.getMonsterHitboxes().filter((hitbox) => {
      if (!this.shapeIntersectsOrientedRect(hitbox.shape, origin, aim, range, halfThickness)) {
        return false;
      }
      if (halfAngle <= 0) {
        return true;
      }
      return this.shapeIntersectsSector(hitbox.shape, origin.x, origin.y, range, aim, halfAngle);
    });
  }

  getMonsterHitboxesWithinRing(inner: number, outer: number) {
    const originX = this.player.x;
    const originY = this.player.y;
    return this.getMonsterHitboxes().filter((hitbox) =>
      this.shapeIntersectsRing(hitbox.shape, originX, originY, inner, outer),
    );
  }

  getMonsterHitboxesWithinLane(range: number, halfWidth: number) {
    const aim = this.getAimAngle();
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y);
    return this.getMonsterHitboxes().filter((hitbox) =>
      this.shapeIntersectsOrientedRect(hitbox.shape, origin, aim, range, halfWidth),
    );
  }

  private spawnDamageNumber(x: number, y: number, damage: number, isDot: boolean) {
    const label = this.scene.add
      .text(x, y, `${Math.round(damage)}`, {
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 3)
      .setScale(0.9);

    label.setTint(isDot ? 0xffc56f : 0xfff4d3);

    this.scene.tweens.add({
      targets: label,
      y: y - 22,
      alpha: { from: 1, to: 0 },
      duration: isDot ? 500 : 360,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  hitMonster(
    baseDamage: number,
    emoji: string = '💥',
    hitboxes: MonsterHitbox[] = [],
    options: { isDot?: boolean } = {},
  ) {
    const impacted = hitboxes.length ? hitboxes : this.getMonsterHitboxes();
    if (!impacted.length) return 0;
    const multiplier = impacted
      .map((hitbox) => hitbox.damageMultiplier ?? 1)
      .reduce((max, value) => Math.max(max, value), 0);
    if (multiplier <= 0) {
      return 0;
    }
    const damage = Math.max(0, baseDamage * multiplier);
    if (damage <= 0) {
      return 0;
    }
    const isDot = Boolean(options.isDot);
    this.monster.hp -= damage;
    this.monster.refreshHpBar();
    this.monster.setTint(0xffdddd);
    this.scene.time.delayedCall(80, () => this.monster.clearTint());
    const numberY = this.monster.y - this.monster.displayHeight * 0.35;
    this.spawnDamageNumber(this.monster.x, numberY, damage, isDot);
    this.spawnFloatingEmoji(
      this.monster.x,
      this.monster.y - 30,
      emoji,
      26,
      isDot ? 0xffd18a : 0xfff4d3,
    );
    this.onMonsterDamaged?.({ damage, isDot });
    if (this.monster.hp <= 0) {
      this.onMonsterDefeated();
    }
    return damage;
  }

  showMeleeTelegraph(range: number, color: number, emoji: string, duration = 300) {
    const spread = Phaser.Math.DegToRad(120);
    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.85).setScale(0.45);
    gfx.fillStyle(color, 0.22);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, range, -spread / 2, spread / 2, false);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(3, color, 0.95);
    gfx.beginPath();
    gfx.arc(0, 0, range, -spread / 2, spread / 2, false);
    gfx.strokePath();

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.95)
      .setScale(0.9);

    const updatePositions = () => {
      const angle = this.getAimAngle();
      gfx.setPosition(this.player.x, this.player.y);
      gfx.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range * 0.92;
      const tipY = this.player.y + Math.sin(angle) * range * 0.92;
      if (icon.active) icon.setPosition(tipX, tipY - 18);
    };

    updatePositions();

    this.scene.tweens.add({
      targets: gfx,
      scale: { from: 0.45, to: 1 },
      alpha: { from: 0.85, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: updatePositions,
      onComplete: () => gfx.destroy(),
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

  showKnifeTelegraph(range: number, color: number, emoji: string, sweep = Phaser.Math.DegToRad(90), duration = 320) {
    const baseAngle = this.getAimAngle();
    const start = baseAngle - sweep / 2;
    const end = baseAngle + sweep / 2;
    const thickness = 24;

    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.95);
    gfx.fillStyle(color, 0.22);
    gfx.fillRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);
    gfx.lineStyle(3, color, 0.9);
    gfx.strokeRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.98);

    const update = (angle: number) => {
      const pivotX = this.player.x;
      const pivotY = this.player.y;
      gfx.setPosition(pivotX, pivotY);
      gfx.setRotation(angle);
      const tipX = pivotX + Math.cos(angle) * range;
      const tipY = pivotY + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY);
    };

    update(start);

    this.scene.tweens.addCounter({
      from: start,
      to: end,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => update(tween.getValue()),
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.98, to: 0 },
      scale: { from: 0.95, to: 1.2 },
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => icon.destroy(),
    });
  }

  showMatchTelegraph(range: number, baseWidth: number, color: number, emoji: string, duration = 360) {
    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.92);
    gfx.fillStyle(color, 0.24);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(range, -baseWidth / 2);
    gfx.lineTo(range * 0.95, -baseWidth * 0.65);
    gfx.lineTo(range * 0.95, baseWidth * 0.65);
    gfx.lineTo(range, baseWidth / 2);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(3, color, 0.9);
    gfx.strokePath();

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '30px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.98);

    const update = () => {
      const angle = this.getAimAngle();
      gfx.setPosition(this.player.x, this.player.y);
      gfx.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range;
      const tipY = this.player.y + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY - 12);
    };

    update();

    this.scene.tweens.add({
      targets: gfx,
      scale: { from: 0.7, to: 1.05 },
      alpha: { from: 0.92, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.98, to: 0 },
      scale: { from: 0.9, to: 1.3 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });
  }

  showStabTelegraph(range: number, thickness: number, color: number, emoji: string, duration = 280) {
    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.95);
    gfx.fillStyle(color, 0.28);
    gfx.fillRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);
    gfx.lineStyle(2, color, 0.9);
    gfx.strokeRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '24px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.96);

    const update = () => {
      const angle = this.getAimAngle();
      gfx.setPosition(this.player.x, this.player.y);
      gfx.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range;
      const tipY = this.player.y + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY - 10);
    };

    update();

    this.scene.tweens.add({
      targets: gfx,
      scaleX: { from: 0.6, to: 1 },
      alpha: { from: 0.95, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.96, to: 0 },
      scale: { from: 0.85, to: 1.2 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });
  }

  showRingTelegraph(inner: number, outer: number, color: number, emoji: string, saw = false, duration = 420) {
    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.9);
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(0, 0, outer);
    gfx.fillStyle(0x161a22, 1);
    gfx.fillCircle(0, 0, inner);
    gfx.lineStyle(3, color, 0.9).strokeCircle(0, 0, outer);
    gfx.lineStyle(2, color, 0.5).strokeCircle(0, 0, inner);

    if (saw) {
      gfx.lineStyle(2, color, 0.7);
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const sx = Math.cos(angle) * inner;
        const sy = Math.sin(angle) * inner;
        const ex = Math.cos(angle) * (outer + 8);
        const ey = Math.sin(angle) * (outer + 8);
        gfx.beginPath();
        gfx.moveTo(sx, sy);
        gfx.lineTo(ex, ey);
        gfx.strokePath();
      }
    }

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '30px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.95);

    const update = (t?: number) => {
      gfx.setPosition(this.player.x, this.player.y);
      icon.setPosition(this.player.x, this.player.y);
      if (typeof t === 'number') {
        const angle = t * Math.PI * 2;
        icon.setPosition(
          this.player.x + Math.cos(angle) * outer * 0.75,
          this.player.y + Math.sin(angle) * outer * 0.75,
        );
      }
    };

    update();

    this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.9, to: 0 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: () => update(),
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Linear',
      onUpdate: (tween) => update(tween.getValue()),
      onComplete: () => icon.destroy(),
    });
  }

  showSelfBuffTelegraph(emoji: string, color: number, duration = 420) {
    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.88);
    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(0, 0, 54);
    gfx.lineStyle(3, color, 0.8).strokeCircle(0, 0, 54);

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.98);

    const update = () => {
      gfx.setPosition(this.player.x, this.player.y);
      icon.setPosition(this.player.x, this.player.y - 12);
    };

    update();

    this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.88, to: 0 },
      scale: { from: 0.85, to: 1.25 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.98, to: 0 },
      scale: { from: 0.95, to: 1.35 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });
  }

  showSmokeTelegraph(radius: number, color: number, emoji: string, duration = 520) {
    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.88);
    gfx.fillStyle(color, 0.18);
    gfx.fillCircle(0, 0, radius);
    gfx.lineStyle(2, color, 0.6).strokeCircle(0, 0, radius);

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '28px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.96);

    const update = () => {
      gfx.setPosition(this.player.x, this.player.y);
      icon.setPosition(this.player.x, this.player.y - 12);
    };

    update();

    this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.88, to: 0 },
      scale: { from: 0.8, to: 1.35 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.96, to: 0 },
      scale: { from: 0.9, to: 1.2 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });
  }

  showThrowTelegraph(
    range: number,
    color: number,
    emoji: string,
    duration = 420,
    thickness = 24,
    tailEmoji?: string,
  ) {
    const gfx = this.scene.add.graphics({ x: this.player.x, y: this.player.y });
    gfx.setDepth(this.fxDepth).setAlpha(0.9);
    gfx.fillStyle(color, 0.24);
    gfx.fillRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);
    gfx.lineStyle(3, color, 0.9);
    gfx.strokeRoundedRect(0, -thickness / 2, range, thickness, thickness / 2);

    const icon = this.scene.add.text(this.player.x, this.player.y, emoji, { fontSize: '24px' })
      .setOrigin(0.5)
      .setDepth(this.fxDepth + 1)
      .setAlpha(0.96);

    const tail = tailEmoji
      ? this.scene.add.text(this.player.x, this.player.y, tailEmoji, { fontSize: '22px' })
          .setOrigin(0.5)
          .setDepth(this.fxDepth + 1)
          .setAlpha(0.88)
      : null;

    const update = () => {
      const angle = this.getAimAngle();
      gfx.setPosition(this.player.x, this.player.y);
      gfx.setRotation(angle);
      const tipX = this.player.x + Math.cos(angle) * range;
      const tipY = this.player.y + Math.sin(angle) * range;
      if (icon.active) icon.setPosition(tipX, tipY);
      if (tail?.active) tail.setPosition(tipX, tipY - thickness * 0.5);
    };

    update();

    this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.9, to: 0 },
      scaleX: { from: 0.75, to: 1.1 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => gfx.destroy(),
    });

    this.scene.tweens.add({
      targets: icon,
      alpha: { from: 0.96, to: 0 },
      scale: { from: 0.95, to: 1.2 },
      duration,
      ease: 'Sine.easeOut',
      onUpdate: update,
      onComplete: () => icon.destroy(),
    });

    if (tail) {
      this.scene.tweens.add({
        targets: tail,
        alpha: { from: 0.88, to: 0 },
        scale: { from: 0.9, to: 1.25 },
        duration,
        ease: 'Sine.easeOut',
        onUpdate: update,
        onComplete: () => tail.destroy(),
      });
    }
  }

  private shapeIntersectsSector(
    shape: MonsterHitbox['shape'],
    originX: number,
    originY: number,
    range: number,
    aim: number,
    halfAngle: number,
  ) {
    if (shape.kind === 'circle') {
      return this.circleIntersectsSector(shape, originX, originY, range, aim, halfAngle);
    }
    return this.capsuleIntersectsSector(shape, originX, originY, range, aim, halfAngle);
  }

  private circleIntersectsSector(
    circle: MonsterHitbox['shape'] & { kind: 'circle' },
    originX: number,
    originY: number,
    range: number,
    aim: number,
    halfAngle: number,
  ) {
    const dx = circle.x - originX;
    const dy = circle.y - originY;
    const distSq = dx * dx + dy * dy;
    const radius = circle.r;
    if (distSq <= radius * radius) {
      return true;
    }
    const rangeWithRadius = range + radius;
    if (distSq > rangeWithRadius * rangeWithRadius) {
      return false;
    }
    const angleToCenter = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - aim);
    if (Math.abs(angleToCenter) <= halfAngle) {
      return true;
    }
    const boundaries = [aim - halfAngle, aim + halfAngle];
    for (const boundary of boundaries) {
      const ca = Math.cos(boundary);
      const sa = Math.sin(boundary);
      const t = dx * ca + dy * sa;
      if (t < 0) {
        continue;
      }
      const clampedT = Phaser.Math.Clamp(t, 0, range);
      const closestX = originX + ca * clampedT;
      const closestY = originY + sa * clampedT;
      const ddx = circle.x - closestX;
      const ddy = circle.y - closestY;
      if (ddx * ddx + ddy * ddy <= radius * radius) {
        return true;
      }
    }
    return false;
  }

  private capsuleIntersectsSector(
    capsule: MonsterHitbox['shape'] & { kind: 'capsule' },
    originX: number,
    originY: number,
    range: number,
    aim: number,
    halfAngle: number,
  ) {
    const length = Phaser.Math.Distance.Between(capsule.ax, capsule.ay, capsule.bx, capsule.by);
    const samples = Math.max(3, Math.ceil(length / Math.max(1, capsule.r * 0.75)));
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const x = Phaser.Math.Linear(capsule.ax, capsule.bx, t);
      const y = Phaser.Math.Linear(capsule.ay, capsule.by, t);
      if (this.circleIntersectsSector({ kind: 'circle', x, y, r: capsule.r }, originX, originY, range, aim, halfAngle)) {
        return true;
      }
    }
    return false;
  }

  private shapeIntersectsOrientedRect(
    shape: MonsterHitbox['shape'],
    origin: Phaser.Math.Vector2,
    angle: number,
    range: number,
    halfWidth: number,
  ) {
    if (shape.kind === 'circle') {
      return this.circleIntersectsOrientedRect(shape, origin, angle, range, halfWidth);
    }
    return this.capsuleIntersectsOrientedRect(shape, origin, angle, range, halfWidth);
  }

  private circleIntersectsOrientedRect(
    circle: MonsterHitbox['shape'] & { kind: 'circle' },
    origin: Phaser.Math.Vector2,
    angle: number,
    range: number,
    halfWidth: number,
  ) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = circle.x - origin.x;
    const dy = circle.y - origin.y;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    const closestX = Phaser.Math.Clamp(localX, 0, range);
    const closestY = Phaser.Math.Clamp(localY, -halfWidth, halfWidth);
    const ddx = localX - closestX;
    const ddy = localY - closestY;
    return ddx * ddx + ddy * ddy <= circle.r * circle.r;
  }

  private capsuleIntersectsOrientedRect(
    capsule: MonsterHitbox['shape'] & { kind: 'capsule' },
    origin: Phaser.Math.Vector2,
    angle: number,
    range: number,
    halfWidth: number,
  ) {
    const length = Phaser.Math.Distance.Between(capsule.ax, capsule.ay, capsule.bx, capsule.by);
    const samples = Math.max(3, Math.ceil(length / Math.max(1, capsule.r * 0.75)));
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const x = Phaser.Math.Linear(capsule.ax, capsule.bx, t);
      const y = Phaser.Math.Linear(capsule.ay, capsule.by, t);
      if (this.circleIntersectsOrientedRect({ kind: 'circle', x, y, r: capsule.r }, origin, angle, range, halfWidth)) {
        return true;
      }
    }
    return false;
  }

  private shapeIntersectsRing(
    shape: MonsterHitbox['shape'],
    originX: number,
    originY: number,
    inner: number,
    outer: number,
  ) {
    if (shape.kind === 'circle') {
      return this.circleIntersectsRing(shape, originX, originY, inner, outer);
    }
    return this.capsuleIntersectsRing(shape, originX, originY, inner, outer);
  }

  private circleIntersectsRing(
    circle: MonsterHitbox['shape'] & { kind: 'circle' },
    originX: number,
    originY: number,
    inner: number,
    outer: number,
  ) {
    const dist = Phaser.Math.Distance.Between(circle.x, circle.y, originX, originY);
    if (dist - circle.r > outer) {
      return false;
    }
    if (dist + circle.r < inner) {
      return false;
    }
    return true;
  }

  private capsuleIntersectsRing(
    capsule: MonsterHitbox['shape'] & { kind: 'capsule' },
    originX: number,
    originY: number,
    inner: number,
    outer: number,
  ) {
    const minSegDistSq = this.distanceSegmentToPointSq(
      capsule.ax,
      capsule.ay,
      capsule.bx,
      capsule.by,
      originX,
      originY,
    );
    const minDist = Math.max(0, Math.sqrt(minSegDistSq) - capsule.r);
    const distA = Phaser.Math.Distance.Between(capsule.ax, capsule.ay, originX, originY);
    const distB = Phaser.Math.Distance.Between(capsule.bx, capsule.by, originX, originY);
    const maxDist = Math.max(distA, distB) + capsule.r;
    if (minDist > outer) {
      return false;
    }
    if (maxDist < inner) {
      return false;
    }
    return true;
  }

  private distanceSegmentToPointSq(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number,
  ) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const lenSq = vx * vx + vy * vy;
    let t = 0;
    if (lenSq > 0) {
      t = Phaser.Math.Clamp((wx * vx + wy * vy) / lenSq, 0, 1);
    }
    const cx = ax + vx * t;
    const cy = ay + vy * t;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy;
  }
}
