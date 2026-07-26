/**
 * heatmap.js – Canvas 2D Heatmap Component
 * HR Competency OS
 *
 * Renders a 2D heatmap of employee × competency scores.
 * No external dependencies — pure Canvas 2D API.
 */

const FONT_FAMILY = "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif";

const ROW_HEIGHT    = 36;
const HEADER_HEIGHT = 80;
const LEFT_COL_W    = 120;
const CELL_PAD      = 2;

/**
 * Maps a 0–5 score to an HSL color string.
 * 0   → red    hsl(0,   80%, 60%)
 * 2.5 → yellow hsl(50,  80%, 60%)
 * 5   → green  hsl(130, 60%, 45%)
 *
 * @param {number} value
 * @returns {string}
 */
function scoreToColor(value) {
  const v = Math.max(0, Math.min(5, value || 0));
  if (v <= 2.5) {
    // red → yellow
    const t   = v / 2.5;
    const hue = Math.round(t * 50);          // 0 → 50
    const sat = 80;
    const lit = 60;
    return `hsl(${hue},${sat}%,${lit}%)`;
  } else {
    // yellow → green
    const t   = (v - 2.5) / 2.5;
    const hue = Math.round(50 + t * 80);     // 50 → 130
    const sat = Math.round(80 - t * 20);     // 80 → 60
    const lit  = Math.round(60 - t * 15);    // 60 → 45
    return `hsl(${hue},${sat}%,${lit}%)`;
  }
}

/**
 * Returns true if the background color is dark enough to warrant white text.
 * Uses the value threshold for simplicity.
 * @param {number} value
 * @returns {boolean}
 */
function isDarkBackground(value) {
  // Values near 0 (red) and near 5 (dark green) use white text.
  // Values near 2.5 (yellow) use black text.
  return value < 1.2 || value > 3.8;
}

export class Heatmap {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   * @param {number} [options.rowHeight=36]
   * @param {number} [options.headerHeight=80]
   * @param {number} [options.leftColWidth=120]
   * @param {number} [options.fontSize=11]
   */
  constructor(canvas, options = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.options = {
      rowHeight:    ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      leftColWidth: LEFT_COL_W,
      fontSize:     11,
      ...options,
    };

    this._employees    = [];
    this._competencies = [];
    this._scores       = [];      // scores[row][col]
    this._clickHandlers = [];
    this._hoverCell    = { row: -1, col: -1 };

    this._clickHandler     = this._onClick.bind(this);
    this._mousemoveHandler = this._onMouseMove.bind(this);
    this._mouseleaveHandler = this._onMouseLeave.bind(this);

    this.canvas.addEventListener('click',      this._clickHandler);
    this.canvas.addEventListener('mousemove',  this._mousemoveHandler);
    this.canvas.addEventListener('mouseleave', this._mouseleaveHandler);
  }

  /**
   * Provide data and trigger render.
   * @param {{ employees: string[], competencies: string[], scores: number[][] }} data
   */
  setData({ employees = [], competencies = [], scores = [] }) {
    this._employees    = employees;
    this._competencies = competencies;
    this._scores       = scores;
    this._hoverCell    = { row: -1, col: -1 };
    this.render();
  }

  /**
   * Re-renders the heatmap (call after resize, data change, or hover change).
   */
  render() {
    const { canvas, ctx, options } = this;
    const { rowHeight, headerHeight, leftColWidth, fontSize } = options;

    // ── Responsive width ─────────────────────────────────────
    const dpr         = window.devicePixelRatio || 1;
    const cssWidth    = canvas.parentElement
      ? canvas.parentElement.clientWidth || 320
      : canvas.offsetWidth || 320;
    const numCols     = this._competencies.length;
    const numRows     = this._employees.length;
    const cssHeight   = headerHeight + numRows * rowHeight + 1;

    canvas.style.width  = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width  = Math.round(cssWidth  * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (!numCols || !numRows) {
      this._drawEmpty(ctx, cssWidth, cssHeight);
      return;
    }

    const cellW = (cssWidth - leftColWidth) / numCols;

    // ── Header: rotated competency labels ────────────────────
    this._drawHeader(ctx, cellW, numCols, headerHeight, leftColWidth, fontSize);

    // ── Rows ─────────────────────────────────────────────────
    for (let row = 0; row < numRows; row++) {
      const y = headerHeight + row * rowHeight;

      // Alternate row background
      ctx.fillStyle = row % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(0, y, cssWidth, rowHeight);

      // Employee name
      this._drawEmployeeName(ctx, this._employees[row], y, rowHeight, leftColWidth, fontSize);

      // Cells
      for (let col = 0; col < numCols; col++) {
        const x     = leftColWidth + col * cellW;
        const score = (this._scores[row] && this._scores[row][col] != null)
          ? this._scores[row][col]
          : 0;
        const isHover = this._hoverCell.row === row && this._hoverCell.col === col;
        this._drawCell(ctx, x, y, cellW, rowHeight, score, isHover, fontSize);
      }
    }

    // ── Grid border lines ─────────────────────────────────────
    this._drawGridLines(ctx, cssWidth, cssHeight, numRows, numCols, cellW, rowHeight, headerHeight, leftColWidth);
  }

  // ── Private draw helpers ─────────────────────────────────────

  _drawEmpty(ctx, w, h) {
    ctx.save();
    ctx.fillStyle    = '#94A3B8';
    ctx.font         = `400 14px ${FONT_FAMILY}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('데이터가 없습니다', w / 2, h / 2);
    ctx.restore();
  }

  _drawHeader(ctx, cellW, numCols, headerHeight, leftColWidth, fontSize) {
    const { options } = this;

    // Header background
    ctx.save();
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 0, leftColWidth + numCols * cellW, headerHeight);

    // "직원" label for left column
    ctx.fillStyle    = '#64748B';
    ctx.font         = `600 ${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('직원', leftColWidth / 2, headerHeight / 2);

    // Rotated competency labels
    for (let col = 0; col < numCols; col++) {
      const cx = leftColWidth + col * cellW + cellW / 2;
      const label = this._competencies[col] || '';

      ctx.save();
      ctx.translate(cx, headerHeight - 8);
      ctx.rotate(-Math.PI / 4);   // -45 degrees
      ctx.fillStyle    = '#1E293B';
      ctx.font         = `500 ${fontSize}px ${FONT_FAMILY}`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';

      // Truncate long labels
      const maxLen = 10;
      const display = label.length > maxLen ? label.slice(0, maxLen) + '…' : label;
      ctx.fillText(display, 0, 0);
      ctx.restore();
    }

    // Bottom border of header
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(leftColWidth + numCols * cellW, headerHeight);
    ctx.stroke();

    ctx.restore();
  }

  _drawEmployeeName(ctx, name, y, rowHeight, leftColWidth, fontSize) {
    ctx.save();
    ctx.fillStyle    = '#1E293B';
    ctx.font         = `400 ${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    const maxLen = 8;
    const display = String(name || '').slice(0, maxLen);
    ctx.fillText(display, 8, y + rowHeight / 2);

    // Right border of left column
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(leftColWidth, y);
    ctx.lineTo(leftColWidth, y + rowHeight);
    ctx.stroke();

    ctx.restore();
  }

  _drawCell(ctx, x, y, cellW, rowHeight, score, isHover, fontSize) {
    ctx.save();

    // Cell background
    const bgColor = scoreToColor(score);
    ctx.fillStyle  = bgColor;
    ctx.fillRect(x + CELL_PAD, y + CELL_PAD, cellW - CELL_PAD * 2, rowHeight - CELL_PAD * 2);

    // Score text
    const textColor = isDarkBackground(score) ? '#FFFFFF' : '#1E293B';
    ctx.fillStyle    = textColor;
    ctx.font         = `600 ${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Number(score).toFixed(1), x + cellW / 2, y + rowHeight / 2);

    // Hover highlight border
    if (isHover) {
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth   = 2;
      ctx.strokeRect(x + CELL_PAD, y + CELL_PAD, cellW - CELL_PAD * 2, rowHeight - CELL_PAD * 2);
    }

    ctx.restore();
  }

  _drawGridLines(ctx, totalW, totalH, numRows, numCols, cellW, rowHeight, headerHeight, leftColWidth) {
    ctx.save();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth   = 0.5;

    // Horizontal row lines
    for (let row = 0; row <= numRows; row++) {
      const y = headerHeight + row * rowHeight;
      ctx.beginPath();
      ctx.moveTo(leftColWidth, y);
      ctx.lineTo(totalW, y);
      ctx.stroke();
    }

    // Vertical column lines
    for (let col = 0; col <= numCols; col++) {
      const x = leftColWidth + col * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalH);
      ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0, 0, totalW, totalH);

    ctx.restore();
  }

  // ── Event coordinate helpers ──────────────────────────────────

  _canvasCoordsToCell(clientX, clientY) {
    const rect    = this.canvas.getBoundingClientRect();
    const cssX    = clientX - rect.left;
    const cssY    = clientY - rect.top;
    const { rowHeight, headerHeight, leftColWidth } = this.options;
    const numCols = this._competencies.length;
    const numRows = this._employees.length;
    const cssWidth = rect.width;

    if (cssX < leftColWidth || cssY < headerHeight) return null;

    const cellW = (cssWidth - leftColWidth) / numCols;
    const col   = Math.floor((cssX - leftColWidth) / cellW);
    const row   = Math.floor((cssY - headerHeight) / rowHeight);

    if (col < 0 || col >= numCols || row < 0 || row >= numRows) return null;
    return { row, col };
  }

  _onClick(e) {
    const cell = this._canvasCoordsToCell(e.clientX, e.clientY);
    if (!cell) return;
    const score = (this._scores[cell.row] && this._scores[cell.row][cell.col] != null)
      ? this._scores[cell.row][cell.col]
      : 0;
    for (const cb of this._clickHandlers) {
      cb(cell.row, cell.col, score);
    }
  }

  _onMouseMove(e) {
    const cell = this._canvasCoordsToCell(e.clientX, e.clientY);
    const newRow = cell ? cell.row : -1;
    const newCol = cell ? cell.col : -1;
    if (newRow !== this._hoverCell.row || newCol !== this._hoverCell.col) {
      this._hoverCell = { row: newRow, col: newCol };
      this.canvas.style.cursor = cell ? 'pointer' : 'default';
      this.render();
    }
  }

  _onMouseLeave() {
    if (this._hoverCell.row !== -1 || this._hoverCell.col !== -1) {
      this._hoverCell = { row: -1, col: -1 };
      this.canvas.style.cursor = 'default';
      this.render();
    }
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Register a cell click callback.
   * @param {(employeeIdx: number, competencyIdx: number, score: number) => void} callback
   */
  addCellClickListener(callback) {
    if (typeof callback === 'function') {
      this._clickHandlers.push(callback);
    }
  }

  /**
   * Remove all event listeners and release canvas references.
   */
  destroy() {
    this.canvas.removeEventListener('click',      this._clickHandler);
    this.canvas.removeEventListener('mousemove',  this._mousemoveHandler);
    this.canvas.removeEventListener('mouseleave', this._mouseleaveHandler);
    this._clickHandlers = [];
  }
}
