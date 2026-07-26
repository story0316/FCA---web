/**
 * radar-chart.js – Canvas-based Radar/Spider Chart
 * HR Competency OS
 *
 * Renders As-Is vs To-Be competency scores on a spider chart.
 * No external dependencies — pure Canvas 2D API.
 */

import { setupHiDPI } from '../utils/canvas-helpers.js';

const FONT_FAMILY = "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif";

export class RadarChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.options = {
      padding:    55,
      fontSize:   11,
      axisColor:  '#CBD5E1',
      gridLevels: 5,
      maxValue:   5,
      showLegend: true,
      showDots:   true,
      animDuration: 600,
      ...options,
    };
    this.data      = null;
    this.onAxisTap = null;
    this._dims     = null;
    this._animRAF  = null;
    this._animStart= null;
    this._animProgress = 1; // 0→1
  }

  /**
   * Set chart data and trigger render.
   * @param {{
   *   labels: string[],
   *   as_is:  number[],
   *   to_be:  number[],
   *   competency_ids?: string[],
   *   ask_data?: Object
   * }} data
   */
  setData(data) {
    this.data = data;
    this._animProgress = 0;
    this._animStart    = null;
    this._startAnimation();
  }

  _startAnimation() {
    if (this._animRAF) cancelAnimationFrame(this._animRAF);
    const animate = (timestamp) => {
      if (!this._animStart) this._animStart = timestamp;
      const elapsed  = timestamp - this._animStart;
      this._animProgress = Math.min(elapsed / this.options.animDuration, 1);

      // Ease-out cubic
      const t = 1 - Math.pow(1 - this._animProgress, 3);
      this._render(t);

      if (this._animProgress < 1) {
        this._animRAF = requestAnimationFrame(animate);
      }
    };
    this._animRAF = requestAnimationFrame(animate);
  }

  render() {
    this._render(1);
  }

  _render(progress = 1) {
    const { canvas, ctx, options } = this;
    const { width, height } = setupHiDPI(canvas);
    this._dims = { width, height };

    ctx.clearRect(0, 0, width, height);

    if (!this.data || !this.data.labels || this.data.labels.length === 0) {
      this._drawEmpty(ctx, width, height);
      return;
    }

    const { labels, as_is = [], to_be = [] } = this.data;
    const n = labels.length;
    const padding = options.padding;
    const legendH = options.showLegend ? 48 : 0;

    const cx = width  / 2;
    const cy = (height - legendH) / 2;
    const radius = Math.min(cx, cy) - padding;

    // ── Grid + Axes ──────────────────────────────────────────
    this._drawGrid(ctx, cx, cy, radius, n);
    this._drawAxes(ctx, cx, cy, radius, n, labels);

    // ── Polygons ─────────────────────────────────────────────
    const asIsPoints = this._getPolygonPoints(as_is,  cx, cy, radius, n, progress);
    const toBePoints = this._getPolygonPoints(to_be, cx, cy, radius, n, progress);

    // Gap fill (only where to_be > as_is)
    this._drawGap(ctx, asIsPoints, toBePoints, as_is, to_be, progress);

    // To-Be polygon (dashed green)
    this._drawPolygon(ctx, toBePoints, 'rgba(16,185,129,0.15)', '#10B981', 2, true);

    // As-Is polygon (solid indigo fill)
    this._drawPolygon(ctx, asIsPoints, 'rgba(79,70,229,0.25)', '#4F46E5', 2, false);

    // ── Data dots ───────────────────────────────────────────
    if (options.showDots) {
      this._drawDots(ctx, asIsPoints, '#4F46E5');
      this._drawDots(ctx, toBePoints, '#10B981', true);
    }

    // ── Labels ───────────────────────────────────────────────
    this._drawLabels(ctx, cx, cy, radius, n, labels, as_is);

    // ── Legend ───────────────────────────────────────────────
    if (options.showLegend) {
      this._drawLegend(ctx, width, height);
    }
  }

  _drawEmpty(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#CBD5E1';
    ctx.font      = `14px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('데이터가 없습니다', width / 2, height / 2);
    ctx.restore();
  }

  _drawGrid(ctx, cx, cy, radius, n) {
    const { gridLevels, axisColor } = this.options;
    ctx.save();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth   = 1;

    for (let level = 1; level <= gridLevels; level++) {
      const r = (level / gridLevels) * radius;
      const points = this._getRawPolygonPoints(cx, cy, r, n, 1);

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      // Level label (1-5) on the right axis
      const labelAngle = -Math.PI / 2; // top axis
      const lx = cx + r * Math.cos(0); // right side
      const ly = cy + r * Math.sin(0);
      ctx.fillStyle    = '#94A3B8';
      ctx.font         = `400 9px ${FONT_FAMILY}`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(level), lx + 3, ly);
    }
    ctx.restore();
  }

  _drawAxes(ctx, cx, cy, radius, n) {
    const { axisColor } = this.options;
    ctx.save();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth   = 1;

    for (let i = 0; i < n; i++) {
      const angle = this._axisAngle(i, n);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawLabels(ctx, cx, cy, radius, n, labels, as_is) {
    const { fontSize } = this.options;
    const labelPad = 18;

    ctx.save();
    for (let i = 0; i < n; i++) {
      const angle = this._axisAngle(i, n);
      const lx = cx + (radius + labelPad) * Math.cos(angle);
      const ly = cy + (radius + labelPad) * Math.sin(angle);

      // Determine alignment based on position
      const deg = (angle * 180) / Math.PI;
      let align = 'center';
      if (Math.cos(angle) < -0.3) align = 'right';
      if (Math.cos(angle) >  0.3) align = 'left';

      // Score beside label
      const score = as_is[i] != null ? Number(as_is[i]).toFixed(1) : '-';

      // Label text
      ctx.font         = `500 ${fontSize}px ${FONT_FAMILY}`;
      ctx.fillStyle    = '#1E293B';
      ctx.textAlign    = align;
      ctx.textBaseline = 'middle';

      const label = labels[i] || '';
      // Truncate long labels
      const maxLen = 8;
      const displayLabel = label.length > maxLen ? label.slice(0, maxLen) + '…' : label;
      ctx.fillText(displayLabel, lx, ly - 7);

      // Score
      ctx.font      = `700 ${fontSize - 1}px ${FONT_FAMILY}`;
      ctx.fillStyle = this._scoreColor(as_is[i]);
      ctx.fillText(score, lx, ly + 7);
    }
    ctx.restore();
  }

  _drawPolygon(ctx, points, fillStyle, strokeStyle, lineWidth = 2, dashed = false) {
    if (!points || points.length < 2) return;
    ctx.save();
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
    ctx.restore();
  }

  _drawGap(ctx, asIsPoints, toBePoints, as_is, to_be, progress) {
    if (!asIsPoints.length || !toBePoints.length) return;
    const n = asIsPoints.length;

    // For each axis where to_be > as_is, draw a gap highlight
    ctx.save();
    ctx.beginPath();

    let hasGap = false;
    for (let i = 0; i < n; i++) {
      const gap = (to_be[i] || 0) - (as_is[i] || 0);
      if (gap > 0.1) hasGap = true;
    }
    if (!hasGap) { ctx.restore(); return; }

    // Draw gap polygon (interleave as_is forward, to_be backward for each segment)
    // Simple approach: draw full gap shape where to_be > as_is
    ctx.moveTo(toBePoints[0].x, toBePoints[0].y);
    for (let i = 0; i < n; i++) {
      ctx.lineTo(toBePoints[i].x, toBePoints[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(239,68,68,0.08)';
    ctx.fill();

    // Redraw as_is on top to clip the overlap
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  _drawDots(ctx, points, color, hollow = false) {
    ctx.save();
    for (const pt of points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      if (hollow) {
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.fillStyle   = '#fff';
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle   = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 1.5;
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawLegend(ctx, width, height) {
    const ly = height - 36;
    const items = [
      { label: 'As-Is (현재)',  color: '#4F46E5', dashed: false },
      { label: 'To-Be (목표)',  color: '#10B981', dashed: true  },
    ];

    const totalW = items.length * 130;
    let startX   = (width - totalW) / 2;

    ctx.save();
    for (const item of items) {
      // Line sample
      ctx.setLineDash(item.dashed ? [6, 4] : []);
      ctx.strokeStyle = item.color;
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.moveTo(startX, ly);
      ctx.lineTo(startX + 24, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot
      ctx.beginPath();
      ctx.arc(startX + 12, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();

      // Label
      ctx.font         = `500 11px ${FONT_FAMILY}`;
      ctx.fillStyle    = '#64748B';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, startX + 30, ly);

      startX += 140;
    }
    ctx.restore();
  }

  // ── Helpers ─────────────────────────────────────────────────

  _axisAngle(index, total) {
    return (Math.PI * 2 * index / total) - Math.PI / 2;
  }

  _getAxisCoords(index, value, total, center, radius) {
    const angle = this._axisAngle(index, total);
    const r = (value / this.options.maxValue) * radius;
    return {
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
    };
  }

  _getPolygonPoints(values, cx, cy, radius, n, progress = 1) {
    return values.map((v, i) => {
      const angle = this._axisAngle(i, n);
      const r = ((v || 0) / this.options.maxValue) * radius * progress;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }

  _getRawPolygonPoints(cx, cy, radius, n, progress = 1) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const angle = this._axisAngle(i, n);
      pts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    return pts;
  }

  _scoreColor(score) {
    if (score == null) return '#94A3B8';
    if (score < 2.0) return '#EF4444';
    if (score < 3.0) return '#F97316';
    if (score < 4.0) return '#F59E0B';
    if (score < 4.5) return '#3B82F6';
    return '#10B981';
  }

  /**
   * Adds tap/click listener. When user taps near an axis label,
   * fires callback(competencyId, index).
   */
  addTapListener(callback) {
    this.onAxisTap = callback;
    const handler = (e) => {
      if (!this.data || !this._dims) return;
      const rect = this.canvas.getBoundingClientRect();
      const tapX = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const tapY = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

      const { labels } = this.data;
      const n = labels.length;
      const { width, height } = this._dims;
      const legendH = this.options.showLegend ? 48 : 0;
      const cx     = width  / 2;
      const cy     = (height - legendH) / 2;
      const radius = Math.min(cx, cy) - this.options.padding;
      const labelPad = 18;

      let closest = -1;
      let closestDist = 40; // pixel tap radius

      for (let i = 0; i < n; i++) {
        const angle = this._axisAngle(i, n);
        const lx = cx + (radius + labelPad) * Math.cos(angle);
        const ly = cy + (radius + labelPad) * Math.sin(angle);
        const dist = Math.sqrt((tapX - lx) ** 2 + (tapY - ly) ** 2);
        if (dist < closestDist) {
          closest = i;
          closestDist = dist;
        }
      }

      if (closest !== -1 && this.onAxisTap) {
        const compId = this.data.competency_ids
          ? this.data.competency_ids[closest]
          : closest;
        this.onAxisTap(compId, closest, this.data.ask_data?.[compId]);
      }
    };

    this.canvas.addEventListener('click',      handler);
    this.canvas.addEventListener('touchstart', handler, { passive: true });
    this._tapHandler = handler;
  }

  destroy() {
    if (this._animRAF) cancelAnimationFrame(this._animRAF);
    if (this._tapHandler) {
      this.canvas.removeEventListener('click',      this._tapHandler);
      this.canvas.removeEventListener('touchstart', this._tapHandler);
    }
  }
}
