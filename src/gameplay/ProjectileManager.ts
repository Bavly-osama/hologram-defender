export interface Projectile {
  id: number;
  active: boolean;
  team: "player" | "hostile";
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  source: number;
  targetId: number;
  weakAim: boolean;
  penetration: number;
  hitsRemaining: number;
}
export class ProjectileManager {
  readonly pool: Projectile[] = Array.from({ length: 160 }, (_, id) => ({
    id,
    active: false,
    team: "player",
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    vx: 0,
    vy: 0,
    life: 0,
    damage: 1,
    source: -1,
    targetId: -1,
    weakAim: false,
    penetration: 1,
    hitsRemaining: 1,
  }));
  get active() {
    return this.pool.filter((p) => p.active);
  }
  spawn(
    team: Projectile["team"],
    x: number,
    y: number,
    tx: number,
    ty: number,
    speed: number,
    damage: number,
    source = -1,
    penetration = 1,
  ) {
    const p = this.pool.find((p) => !p.active);
    if (!p) return;
    const angle = Math.atan2(ty - y, tx - x);
    Object.assign(p, {
      active: true,
      team,
      x,
      y,
      previousX: x,
      previousY: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 5,
      damage,
      source,
      targetId: -1,
      weakAim: false,
      penetration,
      hitsRemaining: penetration,
    });
    return p;
  }
  update(dt: number, onMiss: () => void) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.previousX = p.x;
      p.previousY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < -50 || p.x > 1250 || p.y < -50 || p.y > 800) {
        p.active = false;
        if (p.team === "player") onMiss();
      }
    }
  }
  clear() {
    for (const p of this.pool) p.active = false;
  }
}
