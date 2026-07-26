/**
 * card-swipe.js – Swipeable assessment card component
 * HR Competency OS
 */

import { addSwipeListener, clamp } from '../utils/touch.js';
import { RATING_LABELS } from '../utils/score.js';

export class CardSwipe {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   onScore?: (competencyId, score) => void,
   *   onComplete?: (allScores: Record<string, number>) => void,
   *   competencies?: Array
   * }} options
   */
  constructor(container, options = {}) {
    this.container    = container;
    this.onScore      = options.onScore    || (() => {});
    this.onComplete   = options.onComplete || (() => {});
    this.competencies = [];
    this.currentIndex = 0;
    this.scores       = {};
    this._cleanup     = null;
    this._currentCard = null;

    this._buildShell();
  }

  _buildShell() {
    this.container.innerHTML = `
      <div class="card-swipe-wrapper">
        <div class="card-swipe-progress-wrap">
          <div class="card-swipe-counter" id="cs-counter">0 / 0</div>
          <div class="progress-bar" style="margin: 6px 0;">
            <div class="progress-bar-fill" id="cs-progress" style="width:0%"></div>
          </div>
        </div>
        <div class="swipe-stack" id="cs-stack">
          <div class="card-behind card-behind-2"></div>
          <div class="card-behind"></div>
        </div>
        <div class="rating-buttons-wrap" id="cs-rating-wrap">
          <div class="rating-buttons" id="cs-rating"></div>
        </div>
      </div>
    `;
  }

  /**
   * Load competencies and show first card.
   * @param {Array<{id, name_ko, category, description_ko, level_desc}>} competencies
   */
  load(competencies) {
    this.competencies = competencies;
    this.currentIndex = 0;
    this.scores       = {};
    this._showCard(0);
    this._updateProgress();
  }

  _showCard(index) {
    if (index >= this.competencies.length) {
      this._handleComplete();
      return;
    }

    const stack = document.getElementById('cs-stack');
    if (!stack) return;

    // Remove existing main card
    const old = stack.querySelector('.competency-card');
    if (old) old.remove();

    const comp = this.competencies[index];
    const card = this._renderCard(comp);
    stack.appendChild(card);
    this._currentCard = card;

    // Animate in
    requestAnimationFrame(() => {
      card.style.transition = 'none';
      card.style.transform  = 'translateX(-50%) scale(0.85)';
      card.style.opacity    = '0';
      requestAnimationFrame(() => {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform  = 'translateX(-50%)';
        card.style.opacity    = '1';
      });
    });

    this._setupCardInteraction(card, comp);
    this._buildRatingButtons(comp);
  }

  _renderCard(comp) {
    const card = document.createElement('div');
    card.className = 'competency-card';
    card.innerHTML = `
      <div class="swipe-overlay left" id="overlay-left">👎</div>
      <div class="swipe-overlay right" id="overlay-right">👍</div>
      <div class="card-category">${escapeHtml(comp.category || '역량')}</div>
      <div class="card-name">${escapeHtml(comp.name_ko || comp.name || '')}</div>
      <div class="card-desc">${escapeHtml(comp.description_ko || comp.description || '')}</div>
      ${comp.to_be_level ? `<div style="margin-top:8px">
        <span class="badge badge-primary">목표 수준: ${escapeHtml(comp.to_be_level)}</span>
      </div>` : ''}
      <div class="swipe-hint">
        <div class="swipe-hint-left">← 낮음</div>
        <div style="font-size:0.75rem;color:var(--text-light)">드래그하여 평가</div>
        <div class="swipe-hint-right">높음 →</div>
      </div>
    `;
    return card;
  }

  _buildRatingButtons(comp) {
    const wrap = document.getElementById('cs-rating');
    if (!wrap) return;
    wrap.innerHTML = '';

    for (let score = 1; score <= 5; score++) {
      const btn = document.createElement('button');
      btn.className         = 'rating-btn';
      btn.dataset.score     = score;
      btn.setAttribute('aria-label', `${score}점 - ${RATING_LABELS[score]}`);
      btn.innerHTML = `
        <span class="rating-num">${score}</span>
        <span class="rating-label">${RATING_LABELS[score]}</span>
      `;
      btn.addEventListener('click', () => {
        this._commitScore(score, comp);
      });
      wrap.appendChild(btn);
    }
  }

  _setupCardInteraction(card, comp) {
    if (this._cleanup) this._cleanup();

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    const threshold = 80;

    const overlayLeft  = card.querySelector('#overlay-left');
    const overlayRight = card.querySelector('#overlay-right');

    this._cleanup = addSwipeListener(card, {
      onDragStart: ({ x, y }) => {
        startX = x;
        startY = y;
        isDragging = true;
        card.style.transition = 'none';
      },
      onDrag: ({ dx, dy }) => {
        if (!isDragging) return;
        const rotate = dx * 0.08;
        card.style.transform = `translateX(calc(-50% + ${dx}px)) rotate(${rotate}deg)`;

        // Show overlay hints
        const pct = Math.min(Math.abs(dx) / threshold, 1);
        if (dx < 0) {
          overlayLeft.style.opacity  = pct * 0.9;
          overlayRight.style.opacity = '0';
        } else {
          overlayRight.style.opacity = pct * 0.9;
          overlayLeft.style.opacity  = '0';
        }
      },
      onDragEnd: ({ dx }) => {
        isDragging = false;
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        overlayLeft.style.opacity  = '0';
        overlayRight.style.opacity = '0';

        if (Math.abs(dx) >= threshold) {
          const score = dx < 0 ? 2 : 4; // left=low, right=high
          this._animateOut(card, dx < 0 ? 'left' : 'right', () => {
            this._commitScore(score, comp);
          });
        } else {
          // Snap back
          card.style.transform = 'translateX(-50%)';
        }
      },
      onSwipeLeft:  () => {},
      onSwipeRight: () => {},
    });
  }

  _animateOut(card, direction, callback) {
    const xTarget = direction === 'left' ? '-150%' : '150%';
    card.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
    card.style.transform  = `translateX(calc(-50% + ${direction === 'left' ? '-' : ''}300px)) rotate(${direction === 'left' ? '-' : ''}20deg)`;
    card.style.opacity    = '0';
    setTimeout(() => {
      card.remove();
      if (callback) callback();
    }, 380);
  }

  _commitScore(score, comp) {
    const id = comp.id || comp.competency_id;
    this.scores[id] = score;
    this.onScore(id, score);
    this.currentIndex++;
    this._updateProgress();
    this._showCard(this.currentIndex);
  }

  _updateProgress() {
    const total   = this.competencies.length;
    const current = Math.min(this.currentIndex, total);
    const pct     = total > 0 ? (current / total) * 100 : 0;

    const counter  = document.getElementById('cs-counter');
    const progress = document.getElementById('cs-progress');
    if (counter)  counter.textContent     = `${current} / ${total}`;
    if (progress) progress.style.width    = `${pct}%`;
  }

  _handleComplete() {
    const stack = document.getElementById('cs-stack');
    const ratingWrap = document.getElementById('cs-rating-wrap');
    if (stack) stack.innerHTML = `
      <div class="completion-screen">
        <div class="completion-icon">🎉</div>
        <div class="completion-title">평가 완료!</div>
        <div class="completion-desc">모든 역량 자가 평가를 완료했습니다.</div>
      </div>
    `;
    if (ratingWrap) ratingWrap.style.display = 'none';
    this.onComplete(this.scores);
  }

  /**
   * Returns current scores map.
   */
  getScores() {
    return { ...this.scores };
  }

  destroy() {
    if (this._cleanup) this._cleanup();
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
