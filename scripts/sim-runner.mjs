#!/usr/bin/env node
// scripts/sim-runner.mjs — `npm run sim`의 진입점.
//
// 사용법:
//   npm run sim            → 시련 3종 × 20회(기본, 빠른 확인용)
//   npm run sim -- 200     → 시련 3종 × 200회(GDD §6 측정 조건 그대로)
//
// tsc(tsconfig.sim.json, CommonJS 출력)로 컴파일된 dist-sim/의 sim 코드를 그대로 실행한다.
// src/sim/ 자체는 여기서 한 줄도 재구현하지 않는다 — 브라우저(GameScene)와 완전히 같은 로직이다.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptsDir, '..');
const distSimDir = join(projectRoot, 'dist-sim');

// dist-sim은 tsconfig.sim.json이 CommonJS로 뽑아낸 산출물이다.
// 프로젝트 루트 package.json은 "type":"module"이 기본이라, 이 서브트리만
// CommonJS로 해석되도록 중첩 package.json 마커를 심는다(Node의 표준 규칙).
if (!existsSync(distSimDir)) mkdirSync(distSimDir, { recursive: true });
writeFileSync(join(distSimDir, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);

const runsArg = Number.parseInt(process.argv[2] ?? '', 10);
const runsPerTrial = Number.isFinite(runsArg) && runsArg > 0 ? runsArg : 20;

// 헤드리스 틱 간격(ms). 밸런스 수치가 아니라 시뮬레이션 정밀도/속도 트레이드오프다.
// (브라우저 GameScene은 실제 프레임 delta를 쓴다 — 여긴 헤드리스라 고정 틱이 필요할 뿐이다.)
const TICK_MS = 50;

const { TRIALS, TARGET_METRICS } = await import('../dist-sim/config/balance.js');
const { runOnce } = await import('../dist-sim/sim/headless.js');
const { computeTrialMetrics } = await import('../dist-sim/sim/metrics.js');

/** 시련 id 문자열 → 32비트 시드. Math.random 없이 결정론적으로 트라이얼별 시드를 나눈다. */
function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fmt(v) {
  return Number.isFinite(v) ? v.toFixed(3) : String(v);
}

let allPass = true;

function reportRange(label, value, range) {
  const [min, max] = range;
  const ok = Number.isFinite(value) && value >= min && value <= max;
  allPass = allPass && ok;
  console.log(`  ${label.padEnd(28)} ${fmt(value).padStart(8)}   합격 ${min}~${max}   ${ok ? 'OK' : 'OUT'}`);
}

function reportMax(label, value, max) {
  const ok = Number.isFinite(value) && value <= max;
  allPass = allPass && ok;
  console.log(`  ${label.padEnd(28)} ${fmt(value).padStart(8)}   합격 ≤${max}   ${ok ? 'OK' : 'OUT'}`);
}

console.log(`[sim] 시련 ${TRIALS.length}종 × ${runsPerTrial}회, 헤드리스 틱 ${TICK_MS}ms`);

for (const trial of TRIALS) {
  const baseSeed = hashSeed(trial.id);
  const summaries = [];
  for (let i = 0; i < runsPerTrial; i++) {
    summaries.push(runOnce(trial, (baseSeed + i * 7919) >>> 0, TICK_MS));
  }
  const m = computeTrialMetrics(trial.id, summaries);

  console.log(`\n=== ${trial.name} (${trial.id}) — ${runsPerTrial}회 ===`);
  reportRange('시련별 클리어율', m.clearRate, TARGET_METRICS.CLEAR_RATE);
  reportRange('사망 생존시간 중앙값/목표', m.deathTimeRatioMedian, TARGET_METRICS.DEATH_TIME_RATIO_MEDIAN);
  reportMax('30초 이전 사망 비율', m.earlyDeathRate, TARGET_METRICS.EARLY_DEATH_RATE_MAX);
  reportRange('판당 레벨업 횟수 중앙값', m.levelupsMedian, TARGET_METRICS.LEVELUPS_MEDIAN);
  reportRange('판 평균 초당 처치 수', m.killsPerSecMean, TARGET_METRICS.KILLS_PER_SEC_MEAN);
  reportMax('동시 최대 적 수 p95', m.maxAliveP95, TARGET_METRICS.MAX_ALIVE_P95_MAX);
  reportRange('도달 난이도 스텝 중앙값', m.reachedStepMedian, TARGET_METRICS.REACHED_STEP_MEDIAN);
  reportMax('클리어 시각 중앙값(초)', m.clearTimeMedian, TARGET_METRICS.CLEAR_TIME_MEDIAN_MAX_SEC);
}

if (runsPerTrial < TARGET_METRICS.RUNS_PER_TRIAL) {
  console.log(
    `\n[sim] 참고: 이번 실행은 ${runsPerTrial}회(빠른 확인용)다. ` +
      `GDD §6의 정식 측정 조건은 ${TARGET_METRICS.RUNS_PER_TRIAL}회다 → npm run sim -- ${TARGET_METRICS.RUNS_PER_TRIAL}`,
  );
} else {
  console.log(`\n[sim] ${TARGET_METRICS.RUNS_PER_TRIAL}회 정식 측정 완료. ${allPass ? '8개 지표 전부 합격 구간 안.' : '합격 구간을 벗어난 지표가 있다(위 OUT 표시).'}`);
}
