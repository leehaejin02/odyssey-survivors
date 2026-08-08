// ─────────────────────────────────────────────────────────────
// pool.ts — "소프트 풀": 비활성 슬롯을 재사용하고, 없으면만 배열을 늘린다.
// 매 프레임 new/splice로 만들고 버리는 것을 막는다(이 장르의 흔한 GC 스파이크 원인).
// 고정 용량을 박지 않는 이유: SPAWN.MAX_ALIVE(적) 외에는 balance.ts에 상한이 없고,
// 임의의 상한값을 새로 지어내면 "밸런스 리터럴은 balance.ts에만" 원칙에 어긋난다.
// ─────────────────────────────────────────────────────────────

export interface Poolable {
  active: boolean;
}

/** 비활성 슬롯을 찾아 재사용하고, 없으면 factory()로 새 슬롯을 만들어 pool에 추가한다. */
export function acquireSlot<T extends Poolable>(pool: T[], factory: () => T): T {
  for (const item of pool) {
    if (!item.active) return item;
  }
  const item = factory();
  pool.push(item);
  return item;
}
