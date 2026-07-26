/**
 * canvas-helpers.js – Canvas 2D utility functions
 * HR Competency OS
 */

/**
 * Sets up a canvas for HiDPI (retina) rendering.
 * Call this before drawing. Returns the effective display dimensions.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ width: number, height: number, dpr: number }}
 */
export function setupHiDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width  = rect.width  || canvas.offsetWidth  || 300;
  const height = rect.height || canvas.offsetHeight || 300;

  canvas.width  = Math.round(width  * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Return logical (CSS) dimensions
  return { width, height, dpr };
}

/**
 * Draws a rounded rectangle path.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawRoundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x, y + h - r,     r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}

/**
 * Draws text with optional alignment, color, font options.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{
 *   font?: string,
 *   size?: number,
 *   weight?: string,
 *   color?: string,
 *   align?: CanvasTextAlign,
 *   baseline?: CanvasTextBaseline,
 *   maxWidth?: number,
 *   lineHeight?: number,
 *   wrap?: boolean
 * }} options
 */
export function drawText(ctx, text, x, y, options = {}) {
  const {
    font       = "'Noto Sans KR', sans-serif",
    size       = 12,
    weight     = '400',
    color      = '#1E293B',
    align      = 'center',
    baseline   = 'middle',
    maxWidth,
    lineHeight = 1.4,
    wrap       = false,
  } = options;

  ctx.save();
  ctx.font        = `${weight} ${size}px ${font}`;
  ctx.fillStyle   = color;
  ctx.textAlign   = align;
  ctx.textBaseline = baseline;

  if (wrap && maxWidth) {
    const lines = wrapText(ctx, text, maxWidth);
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * size * lineHeight);
    });
  } else if (maxWidth) {
    ctx.fillText(text, x, y, maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}

/**
 * Wraps text to fit within maxWidth, returns array of lines.
 */
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draws a filled circle.
 */
export function drawCircle(ctx, cx, cy, radius, fillColor, strokeColor, strokeWidth = 0) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = strokeWidth;
    ctx.stroke();
  }
}

/**
 * Draws a polygon from an array of {x, y} points.
 */
export function drawPolygon(ctx, points, fillStyle, strokeStyle, lineWidth = 1.5, dashed = false) {
  if (!points || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth   = lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Draws a horizontal color-scale legend bar.
 * colors: [{color, label}]
 */
export function drawColorLegend(ctx, x, y, w, h, colors) {
  const segW = w / colors.length;
  colors.forEach((c, i) => {
    ctx.fillStyle = c.color;
    drawRoundedRect(ctx, x + i * segW, y, segW - 2, h, 2);
    ctx.fill();
  });
}

/**
 * Converts polar coordinates to Cartesian.
 */
export function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Draws a dashed line between two points.
 */
export function drawDashedLine(ctx, x1, y1, x2, y2, dash = [6, 4], color = '#94A3B8', width = 1) {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Clears entire canvas.
 */
export function clearCanvas(canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
