// ─────────────────────────────────────────────────────────────
// colors.ts — VISUAL.COLOR의 숫자(0xRRGGBB)를 Phaser Text가 요구하는 CSS 문자열로 변환한다.
// balance.ts 색 상수를 그대로 쓰기 위한 변환기일 뿐, 여기에 색 값을 새로 정의하지 않는다(하네스 2).
// ─────────────────────────────────────────────────────────────

export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
