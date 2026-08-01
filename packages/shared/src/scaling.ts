/**
 * 分量缩放（REQUIREMENTS.md 1.4）：纯展示行为，不修改原始数据。
 * 缩放结果做智能取整：1.33 个鸡蛋 → "约 1⅓ 个"，而不是刺眼的小数。
 */

const FRACTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: '' },
  { value: 0.25, label: '¼' },
  { value: 1 / 3, label: '⅓' },
  { value: 0.5, label: '½' },
  { value: 2 / 3, label: '⅔' },
  { value: 0.75, label: '¾' },
];

/** 模糊用量（适量/少许/按口味）不参与缩放，调用前请先用 amountType 过滤 */
export function scaleQuantity(quantity: number, fromServings: number, toServings: number): number {
  if (fromServings <= 0) return quantity;
  return (quantity * toServings) / fromServings;
}

export function formatScaledQuantity(quantity: number): string {
  if (quantity <= 0) return '0';

  const whole = Math.floor(quantity);
  const frac = quantity - whole;

  let nearest = FRACTIONS[0];
  let nearestDiff = frac;
  for (const f of FRACTIONS) {
    const diff = Math.abs(frac - f.value);
    if (diff < nearestDiff) {
      nearest = f;
      nearestDiff = diff;
    }
  }

  const isApprox = nearestDiff > 0.02;
  let display: string;
  if (!nearest.label) {
    display = whole > 0 ? `${whole}` : quantity.toFixed(1);
  } else if (whole > 0) {
    display = `${whole}${nearest.label}`;
  } else {
    display = nearest.label;
  }

  return isApprox ? `约 ${display}` : display;
}
