#!/usr/bin/env node
// gh-pages 브랜치로 dist/를 배포한다. `git worktree`만 사용 — 새 npm 의존성 없음(하네스 8).
// actions/deploy-pages는 쓰지 않는다 (카피바라에서 deployment_queued로 5회 정체한 전례. HANDOFF.md 53행).
//
// 절차:
//   1. npm run build (dist/ 생성 — 이미 최신이면 생략 가능)
//   2. 별도 워크트리(.gh-pages-worktree)에 gh-pages 브랜치를 체크아웃(없으면 orphan 생성)
//   3. dist/ 내용을 워크트리로 복사, 커밋, origin에 push
//   4. 워크트리 정리
//
// main 작업 트리의 브랜치는 건드리지 않는다.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(projectRoot, 'dist');
const worktreeDir = join(projectRoot, '.gh-pages-worktree');
const branch = 'gh-pages';

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  return execFileSync(cmd, args, { cwd: projectRoot, stdio: 'inherit', ...opts });
}

function runCapture(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: projectRoot }).toString().trim();
  } catch {
    return '';
  }
}

// 1. build
run('npm', ['run', 'build']);

if (!existsSync(distDir) || readdirSync(distDir).length === 0) {
  console.error('[deploy] dist/ 가 비어 있다. 빌드가 실패했을 수 있다.');
  process.exit(1);
}

// 2. 기존 워크트리 정리
if (existsSync(worktreeDir)) {
  try {
    run('git', ['worktree', 'remove', worktreeDir, '--force']);
  } catch {
    rmSync(worktreeDir, { recursive: true, force: true });
  }
}
run('git', ['worktree', 'prune']);

// origin에 gh-pages 브랜치가 있는지 확인 (없으면 fetch가 실패할 수 있으므로 무시)
try {
  run('git', ['fetch', 'origin', branch], { stdio: 'ignore' });
} catch {
  // gh-pages가 원격에 아직 없음 — orphan 생성 경로로 진행
}
const remoteRef = runCapture('git', ['ls-remote', '--heads', 'origin', branch]);

if (remoteRef) {
  // 이미 있으면 그 브랜치를 워크트리로 체크아웃
  run('git', ['worktree', 'add', '-B', branch, worktreeDir, `origin/${branch}`]);
} else {
  // 없으면 orphan 브랜치로 새로 생성
  run('git', ['worktree', 'add', '--orphan', '-b', branch, worktreeDir]);
}

// 3. 워크트리 내용을 dist/ 로 교체 (.git 디렉터리는 보존)
for (const entry of readdirSync(worktreeDir)) {
  if (entry === '.git') continue;
  rmSync(join(worktreeDir, entry), { recursive: true, force: true });
}
cpSync(distDir, worktreeDir, { recursive: true });
writeFileSync(join(worktreeDir, '.nojekyll'), '');

// 4. 커밋 & 푸시
run('git', ['-C', worktreeDir, 'add', '-A']);
const status = runCapture('git', ['-C', worktreeDir, 'status', '--porcelain']);
if (!status) {
  console.log('[deploy] 변경 사항 없음 — 커밋 생략.');
} else {
  const sha = runCapture('git', ['rev-parse', '--short', 'HEAD']);
  run('git', ['-C', worktreeDir, 'commit', '-m', `deploy: ${sha}`]);
  run('git', ['-C', worktreeDir, 'push', 'origin', branch]);
}

// 5. 정리
run('git', ['worktree', 'remove', worktreeDir, '--force']);

console.log('[deploy] 완료.');
