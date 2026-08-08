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

// 탐지 대상 (전부 실제 import/require 구문만 — 주석 속 단순 언급은 대상 아님):
//   import Phaser from 'phaser'        (기본 import)
//   import 'phaser'                    (부수효과 import, from 없음)
//   import { X } from 'phaser'         (named import)
//   export { X } from 'phaser'         (재수출)
//   import('phaser')                   (동적 import)
//   require('phaser')                  (CommonJS)
//   'phaser/...'                       (하위 경로)
const phaserImportPattern = new RegExp(
  [
    // import (선택적으로 "... from ") 'phaser' | 'phaser/subpath'  — from이 없으면 부수효과 import
    String.raw`\bimport\s+(?:[^'";]*?\bfrom\s+)?['"]phaser(?:\/[^'"]*)?['"]`,
    // export ... from 'phaser'
    String.raw`\bexport\s+[^'";]*?\bfrom\s+['"]phaser(?:\/[^'"]*)?['"]`,
    // 동적 import('phaser')
    String.raw`\bimport\s*\(\s*['"]phaser(?:\/[^'"]*)?['"]`,
    // require('phaser')
    String.raw`\brequire\s*\(\s*['"]phaser(?:\/[^'"]*)?['"]`,
  ].join('|'),
);

// 주석 안에서 "Phaser를 import하지 않는다" 같은 서술이 오탐되지 않도록
// 정규식 적용 전에 주석을 제거한다. 문자열 리터럴 내용은 건드리지 않는다
// (import/require 구문 자체는 문자열이 될 수 없으므로 주석만 제거해도 충분하다).
function stripComments(source) {
  let result = source.replace(/\/\*[\s\S]*?\*\//g, ''); // block comments
  result = result.replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments (":" 방지 = URL의 "//" 오제거 회피)
  return result;
}

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
  const content = stripComments(readFileSync(file, 'utf8'));
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
