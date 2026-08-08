import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ASSETS } from './src/config/balance.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────
// 빌드타임 에셋 존재 여부 매니페스트.
//
// 실측(CDP로 확인, 2026-08-08): 브라우저는 fetch()/XHR/<img> 어떤 방식으로 확인하든
// 404 응답 하나마다 "Failed to load resource" 를 Console에 error 레벨로 자동으로 찍는다
// (개발자가 try/catch로 잡을 수 있는 JS 예외가 아니라 브라우저 네트워크 스택이 직접 남기는 로그다).
// 즉 "런타임에 존재를 확인하고 없으면 스킵"하는 방식은 확인 요청 자체가 이미 콘솔 에러를 만든다.
//
// 그래서 존재 확인을 "런타임 네트워크 요청"이 아니라 "빌드타임 파일시스템 확인"으로 옮긴다.
// vite.config.ts는 Node에서 실행되므로 public/ 실제 파일 유무를 fs로 직접 확인할 수 있고,
// 그 결과를 define으로 클라이언트 번들에 상수로 굽는다 — 없는 파일은 애초에 load 요청 자체가 안 나간다.
// 경로 원본은 balance.ts의 ASSETS.PATHS 하나뿐이다(여기서 새 경로 문자열을 만들지 않는다).
// ─────────────────────────────────────────────────────────────
const assetAvailability = Object.fromEntries(
  Object.entries(ASSETS.PATHS).map(([key, relativePath]) => [key, existsSync(join(rootDir, 'public', relativePath))]),
);

// GitHub Pages 배포 경로: https://leehaejin02.github.io/odyssey-survivors/
export default defineConfig({
  base: '/odyssey-survivors/',
  build: {
    outDir: 'dist',
  },
  define: {
    __ASSET_AVAILABILITY__: JSON.stringify(assetAvailability),
  },
});
