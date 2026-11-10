/**
 * ui/dashboard.js — Dashboard page renderer (#/)
 */

import {
  getLiveJobs, getJobSessions, createJob, pauseJob, endJob, resumeJob
} from '../state.js';
import { schedulePush } from '../storage.js';
import { rangeStats, workedHoursByDay, weekStart, weekEnd } from '../calc.js';
import { timerStart, timerStop, getTimerDisplay, syncTimers } from '../timer.js';
import { today, formatDuration, formatHMS, toLocalDateStr } from '../utils.js';
import {
  showToast, showModal, confirm, makeButton, makeFormGroup,
  makeInput, makeChip, makeProgressBar, el, clearEl
} from './components.js';

let _showEnded = false;

/** Main render entry point for dashboard. */
export function renderDashboard() {
  const page = document.getElementById('page-dashboard');
  clearEl(page);

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.className = 'flex align-center justify-between wrap gap-3 mt-4';

  const heading = el('h2', 'section-heading', 'Jobs');
  heading.style.marginBottom = '0';
  heading.style.flex = '1';

  const btnRow = document.createElement('div');
  btnRow.className = 'flex gap-2 wrap';

  const newJobBtn = makeButton('+ New Job', 'btn btn--yellow');
  newJobBtn.addEventListener('click', () => openNewJobDialog());

  const toggleEndedBtn = makeButton(
    _showEnded ? 'Hide Ended' : 'Show Ended',
    'btn btn--sm'
  );
  toggleEndedBtn.addEventListener('click', () => {
    _showEnded = !_showEnded;
    renderDashboard();
  });

  btnRow.appendChild(newJobBtn);
  btnRow.appendChild(toggleEndedBtn);
  toolbar.appendChild(heading);
  toolbar.appendChild(btnRow);
  page.appendChild(toolbar);

  // ── No settings callout ───────────────────────────────────────────────────
  const { hasSettings } = window.__app__;
  if (!hasSettings()) {
    const callout = document.createElement('div');
    callout.className = 'callout mt-5';
    const t = el('div', 'callout__title', 'GitHub sync not configured');
    const msg = el('p', null, 'Set up your GitHub token to sync data across devices. Your data is currently only saved in this browser.');
    const settingsBtn = makeButton('Go to Settings →', 'btn btn--blue mt-3');
    settingsBtn.addEventListener('click', () => window.location.hash = '#/settings');
    callout.appendChild(t);
    callout.appendChild(msg);
    callout.appendChild(settingsBtn);
    page.appendChild(callout);
  }

  // ── Job grid ──────────────────────────────────────────────────────────────
  const jobs = getLiveJobs().filter(j => _showEnded || j.status !== 'ended');

  if (jobs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const t = el('div', 'empty-state__title', 'No jobs yet');
    const m = el('p', 'empty-state__text', 'Create your first job to start tracking hours.');
    const btn = makeButton('+ New Job', 'btn btn--yellow');
    btn.addEventListener('click', () => openNewJobDialog());
    empty.appendChild(t);
    empty.appendChild(m);
    empty.appendChild(btn);
    page.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'job-grid';

  for (const job of jobs) {
    grid.appendChild(renderJobCard(job));
  }

  page.appendChild(grid);

  // Start/sync timer ticking
  syncTimers(getLiveJobs());
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function renderJobCard(job) {
  const todayStr = today();
  const wStart = weekStart(todayStr);
  const wEnd   = weekEnd(todayStr);
  const sessions = getJobSessions(job.id);
  const dayMap = workedHoursByDay(sessions);
  const stats = rangeStats(job, sessions, wStart, wEnd, todayStr, dayMap);

  const isRunning = !!job.timer;
  const pct = stats.requiredHours > 0
    ? (stats.workedHours / stats.requiredHours) * 100
    : (stats.workedHours > 0 ? 100 : 0);
  const complete = stats.workedHours >= stats.requiredHours;

  const card = document.createElement('div');
  card.className = 'card job-card';
  card.dataset.jobId = job.id;

  // Header row
  const header = document.createElement('div');
  header.className = 'job-card__header';
  const name = el('div', 'job-card__name');
  name.textContent = job.name;
  const statusChip = makeChip(isRunning ? 'running' : job.status);
  header.appendChild(name);
  header.appendChild(statusChip);
  card.appendChild(header);

  // Weekly hours meta
  const meta = el('div', 'job-card__meta');
  meta.textContent = `${job.weeklyHours}h / week`;
  card.appendChild(meta);

  // Live timer (shown when running)
  const timerEl = document.createElement('div');
  timerEl.className = `job-card__timer${isRunning ? ' running' : ''}`;
  timerEl.id = `timer-${job.id}`;
  timerEl.textContent = isRunning ? getTimerDisplay(job) : '00:00:00';
  card.appendChild(timerEl);

  // This week stats
  const statsEl = document.createElement('div');
  statsEl.className = 'job-card__stats';

  _addStatRow(statsEl, 'Required', formatDuration(stats.requiredHours));
  _addStatRow(statsEl, 'Worked', formatDuration(stats.workedHours));

  const remEl = document.createElement('div');
  remEl.className = 'job-card__stat-row';
  const remLabel = el('span', 'job-card__stat-label', 'Remaining');
  const remValue = el('span', 'job-card__stat-value mono');
  if (stats.remaining < 0) {
    remValue.textContent = `+${formatDuration(Math.abs(stats.remaining))} OVERTIME`;
    remValue.classList.add('overtime');
  } else {
    remValue.textContent = `${formatDuration(stats.remaining)} LEFT`;
    if (stats.remaining === 0) remValue.classList.add('overtime');
  }
  remEl.appendChild(remLabel);
  remEl.appendChild(remValue);
  statsEl.appendChild(remEl);

  card.appendChild(statsEl);

  // Progress bar
  card.appendChild(makeProgressBar(pct, complete));

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'job-card__actions';

  if (job.status === 'active') {
    if (!isRunning) {
      const startBtn = makeButton('▶ Start', 'btn btn--green btn--sm');
      startBtn.addEventListener('click', () => {
        timerStart(job.id);
        schedulePush();
        renderDashboard();
      });
      actions.appendChild(startBtn);
    } else {
      const stopBtn = makeButton('■ Stop', 'btn btn--orange btn--sm');
      stopBtn.addEventListener('click', () => _handleStop(job.id));
      actions.appendChild(stopBtn);
    }

    const pauseBtn = makeButton('⏸ Pause', 'btn btn--blue btn--sm');
    pauseBtn.addEventListener('click', () => {
      pauseJob(job.id);
      schedulePush();
      showToast(`"${job.name}" paused.`, 'info');
      renderDashboard();
    });
    actions.appendChild(pauseBtn);

    const endBtn = makeButton('⏹ End', 'btn btn--sm');
    endBtn.addEventListener('click', () => {
      confirm({
        title: 'End Job',
        message: `End "${job.name}"? You can reopen it later.`,
        confirmLabel: 'End',
        confirmClass: 'btn--red',
        onConfirm: () => {
          endJob(job.id);
          schedulePush();
          showToast(`"${job.name}" ended.`, 'info');
          renderDashboard();
        }
      });
    });
    actions.appendChild(endBtn);
  }

  if (job.status === 'paused') {
    const resumeBtn = makeButton('▶ Resume', 'btn btn--green btn--sm');
    resumeBtn.addEventListener('click', () => {
      resumeJob(job.id);
      schedulePush();
      showToast(`"${job.name}" resumed.`, 'success');
      renderDashboard();
    });
    actions.appendChild(resumeBtn);

    const endBtn = makeButton('⏹ End', 'btn btn--sm');
    endBtn.addEventListener('click', () => {
      confirm({
        title: 'End Job',
        message: `End "${job.name}"?`,
        confirmLabel: 'End',
        confirmClass: 'btn--red',
        onConfirm: () => {
          endJob(job.id);
          schedulePush();
          renderDashboard();
        }
      });
    });
    actions.appendChild(endBtn);
  }

  if (job.status === 'ended') {
    const reopenBtn = makeButton('↩ Reopen', 'btn btn--blue btn--sm');
    reopenBtn.addEventListener('click', () => {
      resumeJob(job.id);
      schedulePush();
      showToast(`"${job.name}" reopened.`, 'success');
      renderDashboard();
    });
    actions.appendChild(reopenBtn);
  }

  const openBtn = makeButton('Open →', 'btn btn--sm');
  openBtn.addEventListener('click', () => {
    window.location.hash = `#/job/${job.id}`;
  });
  actions.appendChild(openBtn);

  card.appendChild(actions);
  return card;
}

function _addStatRow(parent, label, value) {
  const row = document.createElement('div');
  row.className = 'job-card__stat-row';
  const l = el('span', 'job-card__stat-label', label);
  const v = el('span', 'job-card__stat-value mono', value);
  row.appendChild(l);
  row.appendChild(v);
  parent.appendChild(row);
}

function _handleStop(jobId) {
  const result = timerStop(jobId, false);
  if (result.tooShort) {
    confirm({
      title: 'Short Session',
      message: 'Session is under 5 seconds. Save it anyway?',
      confirmLabel: 'Save',
      confirmClass: 'btn--yellow',
      onConfirm: () => {
        timerStop(jobId, true);
        schedulePush();
        showToast('Session saved.', 'success');
        renderDashboard();
      }
    });
    return;
  }
  schedulePush();
  showToast('Session saved.', 'success');
  renderDashboard();
}

// ─── New Job dialog ───────────────────────────────────────────────────────────

function openNewJobDialog() {
  const nameInput = makeInput({ id: 'nj-name', placeholder: 'e.g. Freelance Project', required: true });
  const hoursInput = makeInput({ id: 'nj-hours', type: 'number', value: '14', min: '0.1', step: '0.5', required: true });
  const startInput = makeInput({ id: 'nj-start', type: 'date', value: today(), required: true });

  const form = document.createElement('div');
  form.className = 'flex flex-col gap-4';
  form.appendChild(makeFormGroup('Job Name', nameInput));
  form.appendChild(makeFormGroup('Weekly Hours', hoursInput));
  form.appendChild(makeFormGroup('Start Date', startInput));

  const errorMsg = el('p', 'form-error', '');
  form.appendChild(errorMsg);

  const { close } = showModal({
    title: 'New Job',
    body: form,
    confirmLabel: 'Create',
    confirmClass: 'btn--yellow',
    onConfirm: () => {
      const name = nameInput.value.trim();
      const hours = parseFloat(hoursInput.value);
      const start = startInput.value;

      if (!name) { errorMsg.textContent = 'Name is required.'; return; }
      if (!hours || hours <= 0) { errorMsg.textContent = 'Weekly hours must be > 0.'; return; }
      if (!start) { errorMsg.textContent = 'Start date is required.'; return; }

      createJob({ name, weeklyHours: hours, startDate: start });
      schedulePush();
      showToast(`Job "${name}" created!`, 'success');
      close();
      renderDashboard();
    }
  });

  nameInput.focus();
}

// ─── Live timer tick callback ─────────────────────────────────────────────────

/**
 * Update just the timer display for a specific job card (called by timer.js tick).
 */
export function updateTimerDisplay(jobId, elapsedSeconds) {
  const timerEl = document.getElementById(`timer-${jobId}`);
  if (timerEl) {
    timerEl.textContent = formatHMS(elapsedSeconds);
    timerEl.classList.add('running');
  }
}

export function clearTimerDisplay(jobId) {
  const timerEl = document.getElementById(`timer-${jobId}`);
  if (timerEl) {
    timerEl.textContent = '00:00:00';
    timerEl.classList.remove('running');
  }
}
