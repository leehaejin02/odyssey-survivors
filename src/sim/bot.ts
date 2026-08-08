// ─────────────────────────────────────────────────────────────
// bot.ts — GDD §7 봇 정책. headless playtest 전용(브라우저 실제 플레이는 키보드 입력을 쓴다).
// 무작위 선택 없음 — 시드 고정 RNG(engine이 소유)와 별개로, 봇 자체는 상태만 보고 결정한다.
//
// 구현 결정 (GDD §7-A가 원본. 값은 balance.ts BOT.THREAT_RADIUS_RATIO):
// - "위협"의 감지 반경은 WEAPON_BOW.RANGE * BOT.THREAT_RADIUS_RATIO(=1/3)를 쓴다(사거리 자체를
//   그대로 쓰면 사거리 140px 안에 있기만 해도 늘 "위협"으로 잡혀 오브 회수를 영구히 포기하는
//   실측 버그가 났다 — 90마리가 480x270 화면에 몰리는 후반부에서는 사실상 항상 사거리 내에
//   적이 있기 때문이다). 이 비율은 밸런스 수치가 아니라 측정 도구의 일부다(D10 연장) —
//   바꾸면 과거 측정값과 비교 불가하므로 balance.ts BOT.THREAT_RADIUS_RATIO에서만 바꾼다.
// - 위협이 없을 때만 가장 가까운 경험치 오브로 향한다. 위협이 있으면 회수를 포기하고 이격을 우선한다.
// ─────────────────────────────────────────────────────────────

import { BOT, WEAPON_BOW, type UpgradeDef } from '../config/balance';
import type { PlayerRuntime, RunState } from './types';
import type { Vec2 } from './math';

/** 봇이 "위협"으로 간주하는 감지 반경. WEAPON_BOW.RANGE * BOT.THREAT_RADIUS_RATIO(근거는 위 주석 및 GDD §7-A). */
const BOT_THREAT_RADIUS = WEAPON_BOW.RANGE * BOT.THREAT_RADIUS_RATIO;

export interface BotState {
  nextDecisionAtMs: number;
  direction: Vec2;
}

export function createBotState(): BotState {
  return { nextDecisionAtMs: 0, direction: { x: 0, y: 0 } };
}

/** 반응 지연(BOT.REACTION_DELAY_MS)마다만 방향을 재계산한다. */
export function decideBotMovement(bot: BotState, state: RunState): Vec2 {
  const nowMs = state.elapsedSec * 1000;
  if (nowMs >= bot.nextDecisionAtMs) {
    bot.direction = computeFleeOrPickup(state);
    bot.nextDecisionAtMs = nowMs + BOT.REACTION_DELAY_MS;
  }
  return bot.direction;
}

function computeFleeOrPickup(state: RunState): Vec2 {
  const player = state.player;
  let fx = 0;
  let fy = 0;
  let threatCount = 0;

  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist <= BOT_THREAT_RADIUS) {
      fx += dx / dist / dist;
      fy += dy / dist / dist;
      threatCount++;
    }
  }

  if (threatCount > 0) {
    const mag = Math.hypot(fx, fy) || 1;
    return { x: fx / mag, y: fy / mag };
  }

  let nearestDist = Infinity;
  let nearestDx = 0;
  let nearestDy = 0;
  for (const orb of state.xpOrbs) {
    if (!orb.active) continue;
    const dx = orb.x - player.x;
    const dy = orb.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < nearestDist) {
      nearestDist = d;
      nearestDx = dx;
      nearestDy = dy;
    }
  }

  if (nearestDist < Infinity) {
    const d = nearestDist || 1;
    return { x: nearestDx / d, y: nearestDy / d };
  }

  return { x: 0, y: 0 };
}

/**
 * 3택 선택: BOT.PICK_PRIORITY에서 인덱스가 가장 작은 것.
 * NECTAR는 HP < NECTAR_HP_THRESHOLD면 최우선, 아니면 최하위로 취급한다.
 */
export function decideBotUpgrade(choices: readonly UpgradeDef[], player: PlayerRuntime): UpgradeDef {
  const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  let best = choices[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const choice of choices) {
    let score: number;
    if (choice.id === 'NECTAR') {
      score = hpRatio < BOT.NECTAR_HP_THRESHOLD ? -1 : Number.POSITIVE_INFINITY;
    } else {
      const idx = BOT.PICK_PRIORITY.indexOf(choice.id);
      score = idx === -1 ? Number.POSITIVE_INFINITY : idx;
    }
    if (score < bestScore) {
      bestScore = score;
      best = choice;
    }
  }

  return best;
}
