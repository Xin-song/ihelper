import type { PrintOrientation, RecipeDetailDto } from '@ihelper/shared';
import { formatScaledQuantity, scaleQuantity } from '@ihelper/shared';

/**
 * 把菜谱数据排版成一张可打印的图。
 *
 * 刻意不用 AI 生成：菜谱已经是结构化数据，排版是确定性问题，Canvas 画出来
 * 秒出、离线、可复现，而且中文不会糊。图像生成模型恰恰在渲染文字上最不可靠。
 *
 * A4 @ 150dpi。150 而不是 300，是因为 300dpi 的横版是 3508×2480，
 * toBlob 出来 20MB 以上，家用打印足够的清晰度用 150 就够了。
 */
const A4_150DPI = { short: 1240, long: 1754 };

const PALETTE = {
  bg: '#faf6f1',
  surface: '#ffffff',
  border: '#ece2d6',
  text: '#2c231d',
  muted: '#8a7a6c',
  primary: '#e2622c',
  primaryDark: '#c04f1f',
};

const FONT_STACK = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';

function font(size: number, weight: number | string = 400) {
  return `${weight} ${size}px ${FONT_STACK}`;
}

/**
 * 按宽度折行。中文可以在任意字符间断开，西文单词不能拆，
 * 所以先切成「CJK 单字 / 西文整词」的 token 再逐个塞。
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const tokens = paragraph.match(/[A-Za-z0-9]+[.,%]?|\s+|[^\s]/g) ?? [];
    let line = '';
    for (const token of tokens) {
      const candidate = line + token;
      if (ctx.measureText(candidate).width > maxWidth && line !== '') {
        lines.push(line.trimEnd());
        line = token.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/** 同源图片才能画进 canvas 又导得出来；跨源会污染画布让 toBlob 抛错 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // 封面加载不出来就不画，不该让整张图失败
    img.src = url;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface IngredientLine {
  name: string;
  amount: string;
}

function buildIngredientLines(recipe: RecipeDetailDto, servings: number): IngredientLine[] {
  return recipe.recipeIngredients.map((ri) => {
    if (ri.amountType === 'vague' || ri.quantity === null) {
      return { name: ri.ingredient.name, amount: ri.vagueLabel ?? '适量' };
    }
    const scaled = scaleQuantity(ri.quantity, recipe.servings, servings);
    return {
      name: ri.ingredient.name + (ri.isOptional ? '（可选）' : ''),
      amount: `${formatScaledQuantity(scaled)} ${ri.unit ?? ''}`.trim(),
    };
  });
}

function metaText(recipe: RecipeDetailDto, servings: number): string {
  const parts: string[] = [`${servings} 人份`];
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  if (total > 0) parts.push(`约 ${total} 分钟`);
  if (recipe.difficulty) parts.push(`难度 ${'★'.repeat(recipe.difficulty)}`);
  if (recipe.category) parts.push(recipe.category);
  return parts.join('　·　');
}

export interface PosterOptions {
  orientation: PrintOrientation;
  /** 按几人份渲染，默认用菜谱自己的基准份数 */
  servings?: number;
}

/**
 * 渲染并返回 PNG Blob。
 *
 * 内容装不下时按比例缩小字号重排，而不是裁切 —— 打印出来缺半页步骤是废纸。
 */
export async function renderRecipePoster(
  recipe: RecipeDetailDto,
  options: PosterOptions,
): Promise<Blob> {
  const { orientation } = options;
  const servings = options.servings ?? recipe.servings;

  const width = orientation === 'landscape' ? A4_150DPI.long : A4_150DPI.short;
  const height = orientation === 'landscape' ? A4_150DPI.short : A4_150DPI.long;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas，无法生成图片');

  const cover = recipe.coverImageUrl ? await loadImage(recipe.coverImageUrl) : null;
  const ingredients = buildIngredientLines(recipe, servings);

  // 先用 1.0 试排，装不下就逐档缩小。0.62 是可读性下限，再小打印出来就费眼了。
  let scale = 1;
  let plan = layout(ctx, recipe, ingredients, servings, cover, width, height, orientation, scale);
  while (plan.overflow && scale > 0.62) {
    scale -= 0.04;
    plan = layout(ctx, recipe, ingredients, servings, cover, width, height, orientation, scale);
  }

  plan.draw();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出图片失败'))),
      'image/png',
    );
  });
}

/**
 * 一次排版：先把所有绘制动作算好并测出总高度，再决定要不要缩放重排。
 * 返回的 draw() 才真正落笔。
 */
function layout(
  ctx: CanvasRenderingContext2D,
  recipe: RecipeDetailDto,
  ingredients: IngredientLine[],
  servings: number,
  cover: HTMLImageElement | null,
  width: number,
  height: number,
  orientation: PrintOrientation,
  scale: number,
) {
  const pad = Math.round(64 * scale);
  const s = (n: number) => Math.round(n * scale);

  const ops: Array<() => void> = [];
  let overflow = false;

  // ---- 页头：封面 + 标题 + 描述 + meta ----
  const headerTop = pad;
  const coverSize = cover ? s(orientation === 'landscape' ? 190 : 210) : 0;
  const textLeft = cover ? pad + coverSize + s(28) : pad;
  const textWidth = width - textLeft - pad;

  ctx.font = font(s(46), 800);
  const titleLines = wrapText(ctx, recipe.title, textWidth);
  const titleLineHeight = s(58);

  ctx.font = font(s(19));
  const descLines = recipe.description ? wrapText(ctx, recipe.description, textWidth) : [];
  const descLineHeight = s(29);

  const headerTextHeight =
    titleLines.length * titleLineHeight +
    (descLines.length > 0 ? s(10) + descLines.length * descLineHeight : 0) +
    s(16) +
    s(24);

  const headerHeight = Math.max(coverSize, headerTextHeight);

  ops.push(() => {
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    if (cover) {
      ctx.save();
      drawRoundedRect(ctx, pad, headerTop, coverSize, coverSize, s(16));
      ctx.clip();
      // object-fit: cover —— 按短边铺满再居中裁，避免拉伸变形
      const ratio = Math.max(cover.width, cover.height) / Math.min(cover.width, cover.height);
      const drawW = cover.width >= cover.height ? coverSize * ratio : coverSize;
      const drawH = cover.height > cover.width ? coverSize * ratio : coverSize;
      ctx.drawImage(
        cover,
        pad - (drawW - coverSize) / 2,
        headerTop - (drawH - coverSize) / 2,
        drawW,
        drawH,
      );
      ctx.restore();
    }

    let ty = headerTop + s(6);
    ctx.fillStyle = PALETTE.text;
    ctx.font = font(s(46), 800);
    ctx.textBaseline = 'top';
    for (const line of titleLines) {
      ctx.fillText(line, textLeft, ty);
      ty += titleLineHeight;
    }

    if (descLines.length > 0) {
      ty += s(10);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = font(s(19));
      for (const line of descLines) {
        ctx.fillText(line, textLeft, ty);
        ty += descLineHeight;
      }
    }

    ty += s(16);
    ctx.fillStyle = PALETTE.primaryDark;
    ctx.font = font(s(19), 600);
    ctx.fillText(metaText(recipe, servings), textLeft, ty);
  });

  let y = headerTop + headerHeight + s(28);

  // 分隔线
  const dividerY = y;
  ops.push(() => {
    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = Math.max(1, s(2));
    ctx.beginPath();
    ctx.moveTo(pad, dividerY);
    ctx.lineTo(width - pad, dividerY);
    ctx.stroke();
  });
  y += s(30);

  // ---- 正文：横版左右分栏，竖版上下堆叠 ----
  const bodyTop = y;
  const bodyBottom = height - pad - s(26);

  const twoColumn = orientation === 'landscape';
  const gutter = s(40);
  const ingredientColWidth = twoColumn ? Math.round((width - pad * 2 - gutter) * 0.36) : width - pad * 2;
  const stepColWidth = twoColumn
    ? width - pad * 2 - gutter - ingredientColWidth
    : width - pad * 2;
  const stepColLeft = twoColumn ? pad + ingredientColWidth + gutter : pad;

  // 配料
  const ingredientHeight = measureIngredients(ctx, ingredients, ingredientColWidth, s);
  ops.push(() =>
    drawIngredients(ctx, ingredients, pad, bodyTop, ingredientColWidth, s, PALETTE),
  );

  // 步骤
  const stepTop = twoColumn ? bodyTop : bodyTop + ingredientHeight + s(34);
  const stepHeight = measureSteps(ctx, recipe, stepColWidth, s);
  ops.push(() => drawSteps(ctx, recipe, stepColLeft, stepTop, stepColWidth, s, PALETTE));

  const contentBottom = twoColumn
    ? bodyTop + Math.max(ingredientHeight, stepHeight)
    : stepTop + stepHeight;
  if (contentBottom > bodyBottom) overflow = true;

  // ---- 页脚 ----
  ops.push(() => {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = font(s(15));
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('iHelper · 菜谱', pad, height - pad + s(14));
    ctx.textAlign = 'right';
    const source = recipe.source ? `来源：${recipe.source}` : '';
    ctx.fillText(source, width - pad, height - pad + s(14));
    ctx.textAlign = 'left';
  });

  return { overflow, draw: () => ops.forEach((op) => op()) };
}

function measureIngredients(
  ctx: CanvasRenderingContext2D,
  ingredients: IngredientLine[],
  colWidth: number,
  s: (n: number) => number,
) {
  let h = s(34) + s(18); // 标题 + 间距
  for (const item of ingredients) {
    // 用量是加粗的，要用同一字重测宽，否则这里算出的折行宽度和实际绘制时不一致
    ctx.font = font(s(20), 600);
    const amountWidth = ctx.measureText(item.amount).width;
    ctx.font = font(s(20));
    const nameLines = wrapText(ctx, item.name, colWidth - amountWidth - s(20));
    h += Math.max(1, nameLines.length) * s(30) + s(10);
  }
  return h;
}

function drawIngredients(
  ctx: CanvasRenderingContext2D,
  ingredients: IngredientLine[],
  x: number,
  top: number,
  colWidth: number,
  s: (n: number) => number,
  palette: typeof PALETTE,
) {
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.text;
  ctx.font = font(s(24), 700);
  ctx.fillText('配料', x, top);

  let y = top + s(34) + s(18);
  ctx.font = font(s(20));
  for (const item of ingredients) {
    ctx.font = font(s(20), 600);
    const amountWidth = ctx.measureText(item.amount).width;

    ctx.font = font(s(20));
    ctx.fillStyle = palette.text;
    const nameLines = wrapText(ctx, item.name, colWidth - amountWidth - s(20));
    let lineY = y;
    for (const line of nameLines) {
      ctx.fillText(line, x, lineY);
      lineY += s(30);
    }

    ctx.font = font(s(20), 600);
    ctx.fillStyle = palette.primaryDark;
    ctx.textAlign = 'right';
    ctx.fillText(item.amount, x + colWidth, y);
    ctx.textAlign = 'left';

    const rowHeight = Math.max(1, nameLines.length) * s(30);
    // 虚线分隔，和详情页的配料表一致
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([s(4), s(4)]);
    ctx.beginPath();
    ctx.moveTo(x, y + rowHeight + s(4));
    ctx.lineTo(x + colWidth, y + rowHeight + s(4));
    ctx.stroke();
    ctx.setLineDash([]);

    y += rowHeight + s(10);
  }

  if (ingredients.length === 0) {
    ctx.fillStyle = palette.muted;
    ctx.fillText('（没有配料）', x, y);
  }
}

function measureSteps(
  ctx: CanvasRenderingContext2D,
  recipe: RecipeDetailDto,
  colWidth: number,
  s: (n: number) => number,
) {
  ctx.font = font(s(20));
  const textWidth = colWidth - s(46);
  let h = s(34) + s(18);
  for (const step of recipe.steps) {
    const lines = wrapText(ctx, step.body, textWidth);
    h += lines.length * s(31) + s(20);
    // drawSteps 会在有计时的步骤下面多画一行，测量时漏掉会低估总高、放过该缩放的情况
    if (step.timerSeconds) h += s(24);
  }
  return h;
}

function drawSteps(
  ctx: CanvasRenderingContext2D,
  recipe: RecipeDetailDto,
  x: number,
  top: number,
  colWidth: number,
  s: (n: number) => number,
  palette: typeof PALETTE,
) {
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.text;
  ctx.font = font(s(24), 700);
  ctx.fillText('步骤', x, top);

  let y = top + s(34) + s(18);
  const bullet = s(30);
  const textLeft = x + s(46);
  const textWidth = colWidth - s(46);

  for (const step of recipe.steps) {
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(x + bullet / 2, y + s(13), bullet / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = font(s(16), 700);
    ctx.textAlign = 'center';
    ctx.fillText(String(step.stepNumber), x + bullet / 2, y + s(5));
    ctx.textAlign = 'left';

    ctx.fillStyle = palette.text;
    ctx.font = font(s(20));
    const lines = wrapText(ctx, step.body, textWidth);
    let lineY = y;
    for (const line of lines) {
      ctx.fillText(line, textLeft, lineY);
      lineY += s(31);
    }

    if (step.timerSeconds) {
      ctx.fillStyle = palette.muted;
      ctx.font = font(s(16));
      // 不用 ⏱ 之类的 emoji：中文字体栈里没有彩色 emoji 字形，打印出来是一个豆腐块
      ctx.fillText(`计时 ${Math.round(step.timerSeconds / 60)} 分钟`, textLeft, lineY + s(2));
      lineY += s(24);
    }

    y = lineY + s(20);
  }

  if (recipe.steps.length === 0) {
    ctx.fillStyle = palette.muted;
    ctx.font = font(s(20));
    ctx.fillText('（没有步骤）', x, y);
  }
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
