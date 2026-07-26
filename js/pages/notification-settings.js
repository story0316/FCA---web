/**
 * notification-settings.js — 알림 수신 설정 페이지
 * 사용자가 알림 유형별로 수신 여부를 토글할 수 있다.
 */

import { showToast } from '../components/toast.js';
import { getUser, isApplicant }   from '../auth.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_notification_settings';

const CATEGORIES = [
  {
    key: 'leave',
    icon: '🏖️',
    label: '휴가 알림',
    desc: '휴가 신청 승인/반려 결과',
  },
  {
    key: 'payslip',
    icon: '💰',
    label: '급여명세서',
    desc: '월급날 급여명세서 발급 안내',
  },
  {
    key: 'peer_review',
    icon: '📋',
    label: '동료 평가',
    desc: '동료 평가 마감 3일 전 리마인더',
  },
  {
    key: 'pulse_survey',
    icon: '📊',
    label: '펄스 서베이',
    desc: '매주 서베이 참여 요청',
  },
  {
    key: 'goals',
    icon: '🎯',
    label: 'OKR / 목표',
    desc: '목표 마감 알림 및 체크인 요청',
  },
  {
    key: 'one_on_one',
    icon: '💬',
    label: '1:1 미팅',
    desc: '1:1 미팅 예약 및 리마인더',
  },
  {
    key: 'kudos',
    icon: '🌟',
    label: '칭찬 / 리워드',
    desc: '칭찬 배지 수신 및 포인트 적립',
  },
  {
    key: 'training',
    icon: '📚',
    label: '교육 / 학습',
    desc: '추천 교육 과정 및 마감 안내',
  },
  {
    key: 'mentoring',
    icon: '🤝',
    label: '멘토링',
    desc: '멘토 매칭 및 세션 리마인더',
  },
  {
    key: 'system',
    icon: '🔔',
    label: '시스템 공지',
    desc: '서비스 점검·업데이트 안내',
    required: true,
  },
];

const CHANNELS = [
  { key: 'in_app', label: '앱 내 알림' },
  { key: 'email',  label: '이메일' },
  { key: 'push',   label: '푸시 알림' },
];

function _loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function _saveSettings(settings) {
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

function _defaultOn(key) {
  return ['leave', 'payslip', 'system', 'kudos'].includes(key);
}

export async function mount(container) {
  if (isApplicant()) {
    container.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user = getUser();
  const settings = _loadSettings();

  container.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button onclick="window.navBack()" style="border:none;background:none;font-size:1.1rem;cursor:pointer;padding:4px 8px;color:var(--text)">←</button>
    <div class="top-bar-title">알림 설정</div>
    <div style="width:40px"></div>
  </div>

  <div class="page-content" style="padding-bottom:32px">

    <!-- 채널 설정 -->
    <div style="padding:16px 14px 0">
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">수신 채널</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden">
        ${CHANNELS.map((ch, i) => {
          const on = settings[`channel_${ch.key}`] !== false;
          return `
        <label style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;
                      ${i < CHANNELS.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}cursor:pointer">
          <span style="font-size:0.88rem;font-weight:600">${ch.label}</span>
          <input type="checkbox" class="notif-channel" data-key="channel_${ch.key}"
                 ${on ? 'checked' : ''}
                 style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>`;
        }).join('')}
      </div>
    </div>

    <!-- 카테고리별 설정 -->
    <div style="padding:20px 14px 0">
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">알림 유형</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden">
        ${CATEGORIES.map((cat, i) => {
          const on = settings[cat.key] !== undefined ? settings[cat.key] : _defaultOn(cat.key);
          return `
        <label style="display:flex;align-items:center;gap:12px;padding:13px 16px;
                      ${i < CATEGORIES.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}
                      cursor:${cat.required ? 'default' : 'pointer'}">
          <div style="font-size:1.3rem;width:28px;text-align:center;flex-shrink:0">${cat.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.86rem;font-weight:600">${cat.label}</div>
            <div style="font-size:0.74rem;color:var(--text-muted);margin-top:1px">${cat.desc}</div>
            ${cat.required ? '<div style="font-size:0.68rem;color:#D97706;margin-top:1px">필수 알림 — 끌 수 없습니다</div>' : ''}
          </div>
          <input type="checkbox" class="notif-toggle" data-key="${cat.key}"
                 ${on ? 'checked' : ''} ${cat.required ? 'disabled' : ''}
                 style="width:18px;height:18px;accent-color:var(--primary);flex-shrink:0;
                        cursor:${cat.required ? 'default' : 'pointer'}">
        </label>`;
        }).join('')}
      </div>
    </div>

    <!-- 방해 금지 시간 -->
    <div style="padding:20px 14px 0">
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">방해 금지 시간</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px">
        <label style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;cursor:pointer">
          <div>
            <div style="font-size:0.88rem;font-weight:600">방해 금지 모드</div>
            <div style="font-size:0.74rem;color:var(--text-muted)">설정 시간 내 알림을 무음으로 처리합니다</div>
          </div>
          <input type="checkbox" id="dnd-toggle" data-key="dnd_enabled"
                 ${settings.dnd_enabled ? 'checked' : ''}
                 style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">
        </label>
        <div id="dnd-time-row" style="display:${settings.dnd_enabled ? 'flex' : 'none'};align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.82rem;color:var(--text-muted)">시작</div>
          <input type="time" id="dnd-start" value="${settings.dnd_start || '22:00'}"
                 style="border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:0.82rem;background:var(--bg);color:var(--text)">
          <div style="font-size:0.82rem;color:var(--text-muted)">~</div>
          <input type="time" id="dnd-end" value="${settings.dnd_end || '08:00'}"
                 style="border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:0.82rem;background:var(--bg);color:var(--text)">
        </div>
      </div>
    </div>

    <!-- 저장 버튼 -->
    <div style="padding:24px 14px 0">
      <button id="save-notif-settings" class="btn btn-primary" style="width:100%;min-height:46px;font-size:0.9rem">
        저장
      </button>
    </div>

  </div>
</div>`;

  _bindEvents(container, settings);
}

export function unmount() {}

function _bindEvents(root, settings) {
  const saveBtn = root.querySelector('#save-notif-settings');
  const dndToggle = root.querySelector('#dnd-toggle');
  const dndRow = root.querySelector('#dnd-time-row');

  dndToggle?.addEventListener('change', () => {
    if (dndRow) dndRow.style.display = dndToggle.checked ? 'flex' : 'none';
  });

  saveBtn?.addEventListener('click', () => {
    const updated = { ..._loadSettings() };

    root.querySelectorAll('.notif-toggle').forEach(cb => {
      updated[cb.dataset.key] = cb.checked;
    });
    root.querySelectorAll('.notif-channel').forEach(cb => {
      updated[cb.dataset.key] = cb.checked;
    });

    const dndEnabled = root.querySelector('#dnd-toggle')?.checked || false;
    updated.dnd_enabled = dndEnabled;
    if (dndEnabled) {
      updated.dnd_start = root.querySelector('#dnd-start')?.value || '22:00';
      updated.dnd_end   = root.querySelector('#dnd-end')?.value   || '08:00';
    }

    _saveSettings(updated);
    showToast('알림 설정이 저장되었습니다.', 'success')
    addNotification({ type: 'success', title: '알림 설정', body: '알림 설정이 저장되었습니다.' });
  });
}
