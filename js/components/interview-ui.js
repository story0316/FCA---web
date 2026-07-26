/**
 * interview-ui.js – AI Interview recording UI component
 * HR Competency OS
 * Uses Web Speech API (SpeechRecognition) with textarea fallback.
 */

export class InterviewUI {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   onComplete?: (transcript: string, duration: number) => void,
   *   maxDuration?: number  (seconds, default 180)
   * }} options
   */
  constructor(container, options = {}) {
    this.container   = container;
    this.onComplete  = options.onComplete || (() => {});
    this.maxDuration = options.maxDuration || 180;

    this._transcript   = '';
    this._startTime    = null;
    this._timerInterval= null;
    this._recognition  = null;
    this._isRecording  = false;
    this._useFallback  = false;

    this._SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

    this._buildUI();
  }

  _buildUI() {
    const hasSpeech = !!this._SpeechRecognition;

    this.container.innerHTML = `
      <div class="interview-ui" style="display:flex;flex-direction:column;gap:16px;padding:16px">

        <!-- Transcript area -->
        <div>
          <div style="font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:6px">
            ${hasSpeech ? '🎙️ 음성 인식 텍스트' : '✍️ 텍스트 입력'}
          </div>
          ${hasSpeech
            ? `<div class="transcript-box" id="iu-transcript">
                 <span class="transcript-placeholder" style="color:var(--text-light)">
                   버튼을 눌러 녹음을 시작하세요...
                 </span>
               </div>`
            : `<textarea class="form-textarea" id="iu-fallback"
                 placeholder="이곳에 답변을 입력하세요..." style="min-height:150px"></textarea>`}
        </div>

        <!-- Timer -->
        <div class="timer-display" id="iu-timer" style="display:${hasSpeech ? 'block' : 'none'}">
          00:00 / ${this._formatTime(this.maxDuration)}
        </div>

        <!-- Recording status -->
        <div id="iu-status" style="text-align:center;font-size:0.85rem;color:var(--text-muted);min-height:24px"></div>

        <!-- Controls -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
          ${hasSpeech ? `
            <button class="record-btn" id="iu-record-btn" aria-label="녹음 시작">
              🎙️
            </button>
            <div style="font-size:0.8rem;color:var(--text-muted)" id="iu-btn-label">
              탭하여 녹음 시작
            </div>
          ` : ''}

          <button class="btn btn-primary btn-block" id="iu-submit" disabled>
            💾 답변 저장
          </button>

          ${hasSpeech ? `
            <button class="btn btn-ghost btn-sm" id="iu-text-toggle">
              텍스트로 입력하기
            </button>` : ''}
        </div>

        <!-- Realtime indicator -->
        ${hasSpeech ? `
          <div id="iu-recording-indicator" style="display:none;align-items:center;justify-content:center;gap:8px;color:var(--danger);font-size:0.85rem;font-weight:600">
            <span class="recording-dot"></span>
            녹음 중...
          </div>` : ''}
      </div>
    `;

    this._bindEvents(hasSpeech);
  }

  _bindEvents(hasSpeech) {
    const submitBtn = this.container.querySelector('#iu-submit');

    if (hasSpeech) {
      const recordBtn  = this.container.querySelector('#iu-record-btn');
      const textToggle = this.container.querySelector('#iu-text-toggle');

      recordBtn.addEventListener('click', () => {
        if (this._isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      });

      textToggle?.addEventListener('click', () => this._switchToFallback());

      submitBtn.addEventListener('click', () => this._submit());
    } else {
      // Fallback textarea
      const textarea = this.container.querySelector('#iu-fallback');
      textarea?.addEventListener('input', () => {
        this._transcript = textarea.value.trim();
        submitBtn.disabled = !this._transcript;
      });
      submitBtn.addEventListener('click', () => this._submit());
    }
  }

  /**
   * Sets the question text (displayed in parent; this component handles recording).
   * This method exists for programmatic control.
   */
  setQuestion(questionText) {
    // Question is displayed in the page; component just manages recording
    const status = this.container.querySelector('#iu-status');
    if (status && questionText) {
      status.textContent = '위 질문에 답변해 주세요.';
    }
  }

  /**
   * Starts speech recognition recording.
   */
  startRecording() {
    if (this._isRecording) return;
    if (!this._SpeechRecognition) { this.showFallback(); return; }

    try {
      this._recognition = new this._SpeechRecognition();
    } catch (e) {
      this.showFallback();
      return;
    }

    const rec = this._recognition;
    rec.lang       = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalTranscript = '';

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interim = t;
        }
      }
      this._transcript = finalTranscript;
      this._updateTranscript(finalTranscript, interim);
    };

    rec.onerror = (event) => {
      console.error('[InterviewUI] Speech error:', event.error);
      const msgs = {
        'not-allowed':     '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.',
        'no-speech':       '음성이 감지되지 않았습니다.',
        'network':         '네트워크 오류로 음성 인식을 사용할 수 없습니다.',
        'audio-capture':   '마이크를 찾을 수 없습니다.',
        'service-not-allowed': '음성 인식 서비스를 사용할 수 없습니다.',
      };
      this._setStatus(msgs[event.error] || `오류: ${event.error}`, 'error');
      this._stopRecordingInternal(finalTranscript);
    };

    rec.onend = () => {
      if (this._isRecording) {
        // Auto-restart if still within duration
        const elapsed = this._startTime ? (Date.now() - this._startTime) / 1000 : 0;
        if (elapsed < this.maxDuration - 2) {
          try { rec.start(); } catch (_) {}
        } else {
          this._stopRecordingInternal(finalTranscript);
        }
      }
    };

    try {
      rec.start();
    } catch (e) {
      this.showFallback();
      return;
    }

    this._isRecording = true;
    this._startTime   = Date.now();
    this._startTimer();

    // Update UI
    const recordBtn   = this.container.querySelector('#iu-record-btn');
    const indicator   = this.container.querySelector('#iu-recording-indicator');
    const btnLabel    = this.container.querySelector('#iu-btn-label');
    if (recordBtn) {
      recordBtn.innerHTML = '⏹️';
      recordBtn.classList.add('recording');
    }
    if (indicator) indicator.style.display = 'flex';
    if (btnLabel) btnLabel.textContent = '탭하여 녹음 중지';
    this._setStatus('녹음 중입니다. 질문에 답변해 주세요.');
  }

  /**
   * Stops recording and finalizes transcript.
   */
  stopRecording() {
    if (!this._isRecording) return;
    this._isRecording = false; // Prevent onend from auto-restarting before _stopRecordingInternal runs
    this._stopRecordingInternal(this._transcript);
  }

  _stopRecordingInternal(transcript) {
    this._isRecording = false;
    this._stopTimer();
    if (this._recognition) {
      try { this._recognition.stop(); } catch (_) {}
      this._recognition = null;
    }

    this._transcript = transcript;

    const recordBtn = this.container.querySelector('#iu-record-btn');
    const indicator = this.container.querySelector('#iu-recording-indicator');
    const btnLabel  = this.container.querySelector('#iu-btn-label');
    const submitBtn = this.container.querySelector('#iu-submit');
    const transcriptBox = this.container.querySelector('#iu-transcript');

    if (recordBtn) {
      recordBtn.innerHTML = '🎙️';
      recordBtn.classList.remove('recording');
      recordBtn.classList.add('stopped');
    }
    if (indicator) indicator.style.display = 'none';
    if (btnLabel)  btnLabel.textContent = '다시 녹음하기';

    if (this._transcript.trim()) {
      this._setStatus('녹음이 완료되었습니다. 답변을 제출하거나 다시 녹음하세요.');
      if (submitBtn) submitBtn.disabled = false;
      if (transcriptBox) {
        transcriptBox.innerHTML = escapeHtml(this._transcript);
        transcriptBox.classList.remove('recording');
      }
    } else {
      this._setStatus('음성이 인식되지 않았습니다. 다시 시도해 주세요.');
    }
  }

  _updateTranscript(final, interim) {
    const box = this.container.querySelector('#iu-transcript');
    if (!box) return;
    box.classList.add('recording');
    box.innerHTML = escapeHtml(final) +
      (interim ? `<span style="color:var(--text-light)">${escapeHtml(interim)}</span>` : '');
    box.scrollTop = box.scrollHeight;
  }

  _startTimer() {
    this._stopTimer();
    this._timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
      const remaining = this.maxDuration - elapsed;
      const timerEl = this.container.querySelector('#iu-timer');
      if (timerEl) {
        timerEl.textContent = `${this._formatTime(elapsed)} / ${this._formatTime(this.maxDuration)}`;
        timerEl.classList.toggle('warning', remaining <= 30);
      }
      if (remaining <= 0) {
        this.stopRecording();
      }
    }, 1000);
  }

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  _setStatus(msg, type = '') {
    const status = this.container.querySelector('#iu-status');
    if (!status) return;
    status.textContent = msg;
    status.style.color = type === 'error' ? 'var(--danger)' : 'var(--text-muted)';
  }

  _submit() {
    const duration = this._startTime
      ? Math.floor((Date.now() - this._startTime) / 1000)
      : 0;

    let transcript = this._transcript;
    const fallback = this.container.querySelector('#iu-fallback');
    if (fallback) transcript = fallback.value.trim();

    if (!transcript) {
      this._setStatus('먼저 답변을 입력하거나 녹음해 주세요.', 'error');
      return;
    }

    this.onComplete(transcript, duration);
  }

  _switchToFallback() {
    this._useFallback = true;
    this.showFallback();
  }

  /**
   * Shows text input fallback (when SpeechRecognition is unavailable).
   */
  showFallback() {
    const existing = this.container.querySelector('.interview-ui');
    if (!existing) return;

    const transcriptBox = this.container.querySelector('#iu-transcript');
    const recordSection = this.container.querySelector('#iu-record-btn');
    const timerEl       = this.container.querySelector('#iu-timer');
    const indicator     = this.container.querySelector('#iu-recording-indicator');
    const textToggle    = this.container.querySelector('#iu-text-toggle');
    const submitBtn     = this.container.querySelector('#iu-submit');

    // Hide speech-specific elements
    if (recordSection) recordSection.closest('div')?.style && (recordSection.style.display = 'none');
    if (timerEl)       timerEl.style.display    = 'none';
    if (indicator)     indicator.style.display  = 'none';
    if (textToggle)    textToggle.style.display = 'none';

    // Replace transcript box with textarea
    if (transcriptBox) {
      const textarea = document.createElement('textarea');
      textarea.className   = 'form-textarea';
      textarea.id          = 'iu-fallback';
      textarea.placeholder = '이곳에 답변을 입력하세요...';
      textarea.style.minHeight = '150px';
      if (this._transcript) textarea.value = this._transcript;

      transcriptBox.replaceWith(textarea);

      textarea.addEventListener('input', () => {
        this._transcript = textarea.value.trim();
        if (submitBtn) submitBtn.disabled = !this._transcript;
      });
    }

    this._setStatus('텍스트로 답변을 입력해 주세요.');
    if (submitBtn) submitBtn.disabled = false;
  }

  /**
   * Returns the current transcript.
   */
  getTranscript() {
    const fallback = this.container.querySelector('#iu-fallback');
    return fallback ? fallback.value.trim() : this._transcript;
  }

  destroy() {
    this._stopTimer();
    if (this._recognition) {
      try { this._recognition.stop(); } catch (_) {}
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
