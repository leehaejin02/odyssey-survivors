// ─────────────────────────────────────────────────────────────
// math.ts — 순수 벡터/스칼라 헬퍼. Phaser 의존 없음.
// ─────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 정규화. 길이가 0에 가까우면 {0,0}을 반환한다(0으로 나누기 방지). */
export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}
