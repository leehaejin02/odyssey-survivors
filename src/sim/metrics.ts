// ─────────────────────────────────────────────────────────────
// metrics.ts — GDD §6 8개 지표 집계. 순수 통계 함수, RNG 없음.
// ─────────────────────────────────────────────────────────────

import { TRIAL_TARGET_SEC } from '../config/balance';
import type { RunSummary } from './headless';

export interface TrialMetrics {
  trialId: string;
  runs: number;
  clearRate: number;
  deathTimeRatioMedian: number;
  earlyDeathRate: number;
  levelupsMedian: number;
  killsPerSecMean: number;
  maxAliveP95: number;
  reachedStepMedian: number;
  clearTimeMedian: number;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clampIndex(Math.ceil(p * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[idx];
}

function clampIndex(i: number, min: number, max: number): number {
  return i < min ? min : i > max ? max : i;
}

export function computeTrialMetrics(trialId: string, summaries: RunSummary[]): TrialMetrics {
  const total = summaries.length;
  const cleared = summaries.filter((s) => s.cleared);
  const died = summaries.filter((s) => !s.cleared);
  // ⚠️ 리터럴 30 — GDD §6 "30초 이전 사망 비율"의 "30"에 해당하는 balance.ts 상수가 없다.
  // TARGET_METRICS.EARLY_DEATH_RATE_MAX(0.15)는 있지만 "이르다"의 경계값(30초) 자체는
  // balance.ts 어디에도 없다. gd에게 보고 대상 — EARLY_DEATH_SEC 같은 상수 추가를 권한다.
  const earlyDeaths = died.filter((s) => s.elapsedSec < 30);

  return {
    trialId,
    runs: total,
    clearRate: total > 0 ? cleared.length / total : NaN,
    deathTimeRatioMedian: median(died.map((s) => s.elapsedSec)) / TRIAL_TARGET_SEC,
    earlyDeathRate: total > 0 ? earlyDeaths.length / total : NaN,
    levelupsMedian: median(summaries.map((s) => s.levelUps)),
    killsPerSecMean: mean(summaries.map((s) => (s.elapsedSec > 0 ? (s.kills + s.bossKills) / s.elapsedSec : 0))),
    maxAliveP95: percentile(
      summaries.map((s) => s.maxAliveSeen),
      0.95,
    ),
    reachedStepMedian: median(summaries.map((s) => s.reachedStep)),
    clearTimeMedian: median(cleared.map((s) => s.elapsedSec)),
  };
}
