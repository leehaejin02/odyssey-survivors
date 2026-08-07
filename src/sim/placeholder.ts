// placeholder — gd/tech가 여기에 게임 시뮬레이션 로직을 채운다.
//
// 규칙 (CLAUDE.md 하네스 1, 2, 18):
// - 이 디렉터리 아래 어떤 파일도 Phaser를 import하지 않는다.
//   (검증: npm run build 또는 node scripts/check-boundary.mjs)
// - 브라우저 없이 Node에서 그대로 실행 가능해야 한다 (headless playtest 대상).
// - 밸런스 수치는 src/config/balance.ts(gd 소유)에서 import한다. 직접 상수를 박지 않는다.
// - 결정론 유지: Math.random()을 직접 쓰지 말고 시드 주입형 난수를 사용한다.

export function placeholder(): string {
  return 'sim placeholder';
}
