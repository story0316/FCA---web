/**
 * touch.js – Touch/pointer gesture utilities
 * HR Competency OS
 */

/**
 * Adds swipe gesture listeners to an element.
 * @param {HTMLElement} element
 * @param {{onSwipeLeft?, onSwipeRight?, onSwipeUp?, onSwipeDown?, onDrag?, onDragStart?, onDragEnd?}} callbacks
 * @param {number} threshold – minimum pixel displacement to register swipe (default 80)
 * @returns {Function} cleanup – call to remove all event listeners
 */
export function addSwipeListener(element, callbacks = {}, threshold = 80) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;
  let startTime = 0;

  function getPoint(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onStart(e) {
    const pt = getPoint(e);
    startX = pt.x;
    startY = pt.y;
    currentX = pt.x;
    currentY = pt.y;
    isDragging = true;
    startTime = Date.now();
    if (callbacks.onDragStart) {
      callbacks.onDragStart({ x: startX, y: startY });
    }
  }

  function onMove(e) {
    if (!isDragging) return;
    const pt = getPoint(e);
    currentX = pt.x;
    currentY = pt.y;
    const dx = currentX - startX;
    const dy = currentY - startY;

    // Prevent page scroll if horizontal swipe
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      e.preventDefault();
    }

    if (callbacks.onDrag) {
      callbacks.onDrag({ dx, dy, x: currentX, y: currentY });
    }
  }

  function onEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    const dx = currentX - startX;
    const dy = currentY - startY;
    const elapsed = Date.now() - startTime;

    if (callbacks.onDragEnd) {
      callbacks.onDragEnd({ dx, dy });
    }

    const direction = getSwipeDirection(dx, dy, threshold);

    // Also fire for fast flicks (< 300ms, > 30px)
    const isFastFlick = elapsed < 300 && (Math.abs(dx) > 30 || Math.abs(dy) > 30);
    const fastDirection = isFastFlick ? getSwipeDirection(dx, dy, 30) : null;
    const effectiveDirection = direction || fastDirection;

    if (!effectiveDirection) return;

    switch (effectiveDirection) {
      case 'left':  if (callbacks.onSwipeLeft)  callbacks.onSwipeLeft({ dx, dy });  break;
      case 'right': if (callbacks.onSwipeRight) callbacks.onSwipeRight({ dx, dy }); break;
      case 'up':    if (callbacks.onSwipeUp)    callbacks.onSwipeUp({ dx, dy });    break;
      case 'down':  if (callbacks.onSwipeDown)  callbacks.onSwipeDown({ dx, dy });  break;
    }
  }

  // Use both touch and mouse events for cross-device support
  element.addEventListener('touchstart', onStart, { passive: true });
  element.addEventListener('touchmove',  onMove,  { passive: false });
  element.addEventListener('touchend',   onEnd,   { passive: true });
  element.addEventListener('mousedown',  onStart);
  window.addEventListener('mousemove',   onMove);
  window.addEventListener('mouseup',     onEnd);

  // Cleanup
  return function cleanup() {
    element.removeEventListener('touchstart', onStart);
    element.removeEventListener('touchmove',  onMove);
    element.removeEventListener('touchend',   onEnd);
    element.removeEventListener('mousedown',  onStart);
    window.removeEventListener('mousemove',   onMove);
    window.removeEventListener('mouseup',     onEnd);
  };
}

/**
 * Returns angle in degrees from dx/dy (0 = right, 90 = down).
 */
export function getSwipeAngle(dx, dy) {
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * Returns 'left' | 'right' | 'up' | 'down' | null
 * based on displacement and threshold.
 */
export function getSwipeDirection(dx, dy, threshold = 80) {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < threshold && absDy < threshold) return null;

  if (absDx >= absDy) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

/**
 * Clamps a value between min and max.
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
