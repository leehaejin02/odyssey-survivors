// ─────────────────────────────────────────────────────────────
// global.d.ts — vite.config.ts의 `define`으로 클라이언트 번들에 굽는 빌드타임 상수의 타입.
// 값 자체는 vite.config.ts가 public/ 파일시스템을 fs.existsSync로 확인해 만든다(런타임 네트워크
// 요청이 아니다 — 이유는 vite.config.ts 주석 참조. 브라우저가 404마다 콘솔에 에러를 자동으로 남긴다).
// ─────────────────────────────────────────────────────────────

/** ASSETS.PATHS의 각 키 → public/ 안에 해당 파일이 실제로 존재하는지(빌드타임 확인). */
declare const __ASSET_AVAILABILITY__: Record<string, boolean>;
