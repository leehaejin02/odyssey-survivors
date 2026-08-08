// ─────────────────────────────────────────────────────────────
// metrics.ts — GDD §6 8개 지표 집계. 순수 통계 함수, RNG 없음.
// ─────────────────────────────────────────────────────────────

import { TARGET_METRICS, TRIAL_TARGET_SEC } from '../config/balance';
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
  // "이르다"의 경계값은 TARGET_METRICS.EARLY_DEATH_SEC(=30, GDD §6 정의. 합격선이 아니라 지표 정의).
  const earlyDeaths = died.filter((s) => s.elapsedSec < TARGET_METRICS.EARLY_DEATH_SEC);

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
