// ─────────────────────────────────────────────────────────────
// headless.ts — 봇 정책(§7)으로 한 판을 끝까지 자동 진행한다.
// npm run sim(scripts/sim-runner.mjs)이 이 파일의 runOnce()만 반복 호출한다.
// ─────────────────────────────────────────────────────────────

import type { TrialDef } from '../config/balance';
import { createBotState, decideBotMovement, decideBotUpgrade } from './bot';
import { createRunState, resolveUpgradeChoice, stepRun } from './engine';
import type { DeathCause } from './types';

export interface RunSummary {
  trialId: string;
  seed: number;
  cleared: boolean;
  elapsedSec: number;
  kills: number;
  bossKills: number;
  levelUps: number;
  maxAliveSeen: number;
  reachedStep: number;
  deathCause: DeathCause;
}

/** 틱 수 상한. 무한루프 방지용 안전장치일 뿐 밸런스 값이 아니다(180초 제한시간이면 훨씬 못 미쳐 끝난다). */
const MAX_TICKS_SAFETY = 200_000;

export function runOnce(trial: TrialDef, seed: number, tickMs: number): RunSummary {
  const state = createRunState(trial, seed);
  const bot = createBotState();

  let ticks = 0;
  while (state.result === 'playing' && ticks < MAX_TICKS_SAFETY) {
    ticks++;
    if (state.pendingChoice) {
      const chosen = decideBotUpgrade(state.pendingChoice, state.player);
      resolveUpgradeChoice(state, chosen.id);
      continue;
    }
    const dir = decideBotMovement(bot, state);
    stepRun(state, dir, tickMs);
  }

  return {
    trialId: trial.id,
    seed,
    cleared: state.result === 'cleared',
    elapsedSec: state.elapsedSec,
    kills: state.kills,
    bossKills: state.bossKills,
    levelUps: state.levelUpsCount,
    maxAliveSeen: state.maxAliveSeen,
    reachedStep: state.stepIndex,
    deathCause: state.deathCause,
  };
}
