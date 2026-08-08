// ─────────────────────────────────────────────────────────────
// upgrades.ts — 레벨업 3택 후보 구성 + 적용. GDD §3 규칙의 실제 구현.
//
// 구현 결정 (GDD에 없어 tech가 정한 것 — 보고 대상):
// - 카테고리 안에 후보가 여럿일 때 "어느 걸 보여줄지"는 시드 RNG로 균등 추첨한다.
//   (GDD는 "카테고리에서 하나씩 뽑는다"까지만 규정하고, 카테고리 내부의 선택 규칙은 비어 있었다)
// ─────────────────────────────────────────────────────────────

import { UPGRADE_CATEGORIES, UPGRADE_POOL, type UpgradeDef } from '../config/balance';
import type { PlayerRuntime } from './types';
import { nextInt, type Rng } from './rng';

function isEligible(def: UpgradeDef, upgradeLevels: Record<string, number>): boolean {
  if (def.maxLevel === 0) return true; // 무제한 반복(NECTAR)
  return (upgradeLevels[def.id] ?? 0) < def.maxLevel;
}

/**
 * 3택 후보 구성. 화력 1 + 생존 1 + 유틸 1을 각 카테고리에서 하나씩 뽑고,
 * 만렙 아닌 후보가 없는 카테고리는 건너뛴 뒤 남은 카테고리에서 보충한다.
 * → 결과가 3개 미만일 수 있다(전 종목 만렙인 극단적 후반부). 호출자는 빈 배열도 처리해야 한다.
 */
export function buildUpgradeChoices(rng: Rng, upgradeLevels: Record<string, number>): UpgradeDef[] {
  const chosen: UpgradeDef[] = [];
  const usedIds = new Set<string>();

  for (const category of UPGRADE_CATEGORIES) {
    const eligible = UPGRADE_POOL.filter(
      (def) => def.category === category && !usedIds.has(def.id) && isEligible(def, upgradeLevels),
    );
    if (eligible.length === 0) continue;
    const picked = eligible[nextInt(rng, eligible.length)];
    chosen.push(picked);
    usedIds.add(picked.id);
  }

  // "3택"의 3은 UPGRADE_CATEGORIES.length(화력/생존/유틸)에서 그대로 유도한다 — 새 리터럴을 박지 않는다.
  const choiceCount = UPGRADE_CATEGORIES.length;
  if (chosen.length < choiceCount) {
    const remaining = UPGRADE_POOL.filter((def) => !usedIds.has(def.id) && isEligible(def, upgradeLevels));
    while (chosen.length < choiceCount && remaining.length > 0) {
      const idx = nextInt(rng, remaining.length);
      const picked = remaining.splice(idx, 1)[0];
      chosen.push(picked);
      usedIds.add(picked.id);
    }
  }

  return chosen;
}

/** stat 필드명을 PlayerRuntime의 실제 키로 매핑한다. 'healPct'는 즉시효과라 별도 처리한다. */
type PersistentStatKey = keyof Pick<
  PlayerRuntime,
  'damage' | 'projectiles' | 'cooldownMs' | 'pierce' | 'maxHp' | 'iframeMs' | 'moveSpeed' | 'pickupRadius'
>;

const STAT_FIELD: Record<string, PersistentStatKey> = {
  damage: 'damage',
  projectiles: 'projectiles',
  cooldown: 'cooldownMs',
  pierce: 'pierce',
  maxHp: 'maxHp',
  iframeMs: 'iframeMs',
  moveSpeed: 'moveSpeed',
  pickupRadius: 'pickupRadius',
};

/**
 * 업그레이드 1개를 플레이어에게 적용한다.
 *
 * 구현 결정: HIDE_ARMOR(최대HP+20) 선택 시 현재 HP도 같은 양만큼 함께 올린다.
 * GDD는 "최대HP+20"까지만 규정하고 현재 HP 처리는 비어 있었다 — 장르 관례(최대치 증가분만큼
 * 즉시 회복)를 따랐다. 다르게 해석하려면 gd 확인이 필요하다.
 */
export function applyUpgrade(player: PlayerRuntime, def: UpgradeDef): void {
  player.upgradeLevels[def.id] = (player.upgradeLevels[def.id] ?? 0) + 1;

  if (def.stat === 'healPct') {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * def.value);
    return;
  }

  const field = STAT_FIELD[def.stat];
  if (!field) return;

  if (def.mode === 'add') {
    player[field] += def.value;
    if (field === 'maxHp') {
      player.hp = Math.min(player.maxHp, player.hp + def.value);
    }
  } else if (def.mode === 'mulPct') {
    player[field] *= 1 + def.value;
  }
  // mode === 'pct'는 현재 코드에서 healPct(NECTAR) 하나뿐이라 위에서 이미 처리했다.
}
