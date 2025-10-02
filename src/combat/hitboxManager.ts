import { cloneShape, type HurtShape } from './shapes';

export type HitboxTeam = 'player' | 'monsters';

export type RegisteredHurtbox<TData = unknown> = {
  id: string;
  ownerId: string;
  team: HitboxTeam;
  shape: HurtShape;
  data?: TData;
};

export type HurtboxRegistration<TData = unknown> = {
  id: string;
  shape: HurtShape;
  data?: TData;
};

export class HitboxManager {
  private hurtboxes: RegisteredHurtbox[] = [];

  clear(team?: HitboxTeam) {
    if (!team) {
      this.hurtboxes.length = 0;
      return;
    }
    this.hurtboxes = this.hurtboxes.filter((entry) => entry.team !== team);
  }

  registerHurtboxes<TData = unknown>(
    team: HitboxTeam,
    ownerId: string,
    entries: HurtboxRegistration<TData>[],
  ) {
    this.hurtboxes = this.hurtboxes.filter(
      (existing) => existing.team !== team || existing.ownerId !== ownerId,
    );
    entries.forEach((entry) => {
      this.hurtboxes.push({
        id: entry.id,
        ownerId,
        team,
        shape: cloneShape(entry.shape),
        data: entry.data,
      });
    });
  }

  getHurtboxes(team?: HitboxTeam) {
    if (!team) {
      return this.hurtboxes.map((entry) => ({ ...entry, shape: cloneShape(entry.shape) }));
    }
    return this.hurtboxes
      .filter((entry) => entry.team === team)
      .map((entry) => ({ ...entry, shape: cloneShape(entry.shape) }));
  }

  getTeamSize(team: HitboxTeam) {
    return this.hurtboxes.filter((entry) => entry.team === team).length;
  }
}
