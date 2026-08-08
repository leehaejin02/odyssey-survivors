// ─────────────────────────────────────────────────────────────
// rng.ts — 시드 고정 결정론적 난수 (mulberry32)
// 하네스: sim 어디서도 Math.random()을 직접 쓰지 않는다. 같은 시드 → 같은 결과.
// ─────────────────────────────────────────────────────────────

export interface Rng {
  state: number;
}

/** 시드로부터 새 RNG를 만든다. 0은 mulberry32에서 퇴화하므로 1로 보정한다. */
export function createRng(seed: number): Rng {
  return { state: (seed >>> 0) || 1 };
}

/** [0, 1) 균등분포 다음 값. rng.state를 전진시킨다(호출자 소유 객체를 그 자리에서 변경). */
export function nextFloat(rng: Rng): number {
  let t = (rng.state += 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  t = (t ^ (t >>> 14)) >>> 0;
  return t / 4294967296;
}

/** [min, max) 범위의 다음 실수값. */
export function nextRange(rng: Rng, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

/** [0, maxExclusive) 범위의 다음 정수값. */
export function nextInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive);
}

/** 배열에서 균등확률로 하나를 뽑는다. */
export function pickOne<T>(rng: Rng, arr: readonly T[]): T {
  return arr[nextInt(rng, arr.length)];
}

/** 가중치 배열(weights)에 비례해 인덱스를 하나 뽑는다. 합이 0이면 0을 반환한다. */
export function pickWeightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let roll = nextFloat(rng) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}
