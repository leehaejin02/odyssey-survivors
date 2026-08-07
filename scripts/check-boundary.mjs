#!/usr/bin/env node
// src/sim/ 아래에서 Phaser를 import하면 빌드를 실패시키는 정적 스캐너.
// tsconfig 분리만으로는 tsc가 exit 0을 내기 때문에(경계가 안 걸림) 별도로 존재한다.
// (CLAUDE.md 하네스 1, HANDOFF.md 56행)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const simDir = join(projectRoot, 'src', 'sim');
const targetExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

// import ... from 'phaser'  /  from "phaser/..."  /  require('phaser')  모두 탐지.
const phaserImportPattern = /(?:from\s+|require\(\s*)['"]phaser(?:\/[^'"]*)?['"]/;

function collectFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (targetExtensions.has(extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

const violations = [];
for (const file of collectFiles(simDir)) {
  const content = readFileSync(file, 'utf8');
  if (phaserImportPattern.test(content)) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error('[check-boundary] src/sim/ 아래에서 Phaser import가 발견되었다:');
  for (const file of violations) {
    console.error(`  - ${file}`);
  }
  console.error('src/sim/은 Phaser 없이 Node에서 실행 가능해야 한다 (CLAUDE.md 하네스 1).');
  process.exit(1);
}

console.log(`[check-boundary] OK — src/sim/ 아래 Phaser import 없음. (검사 파일 ${collectFiles(simDir).length}개)`);
process.exit(0);
