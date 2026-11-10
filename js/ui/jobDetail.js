/**
 * ui/jobDetail.js — Job detail page renderer (#/job/<id>)
 * Tabs: Overview, Weeks, Months, Sessions
 */

import {
  getJob, getJobSessions, updateJob, deleteJob,
  addSession, updateSession, deleteSession
} from '../state.js';
import { schedulePush } from '../storage.js';
import {
  rangeStats, workedHoursByDay, allWeeks, allMonths,
  jobFirstDay, jobLastDay, weekStart, weekEnd
} from '../calc.js';
import { today, formatDuration, formatDate, formatTime, localDateTimeToISO, toLocalDateStr } from '../utils.js';
import {
  showToast, showModal, confirm, makeButton, makeFormGroup,
  makeInput, makeTextarea, makeChip, el, clearEl
} from './components.js';

let _activeTab = 'overview';

export function renderJobDetail(jobId) {
  const page = document.getElementById('page-job');
  clearEl(page);

  const job = getJob(jobId);
  if (!job) {
    page.appendChild(el('p', null, 'Job not found.'));
    return;
  }

  // ── Back link ─────────────────────────────────────────────────────────────
  const backBtn = makeButton('← Dashboard', 'btn btn--sm');
  backBtn.addEventListener('click', () => window.location.hash = '#/');
  page.appendChild(backBtn);

  // ── Job header ────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'flex align-center gap-3 wrap mt-4';
  const title = el('h2', null, '');
  title.textContent = job.name; // safe textContent
  const chip = makeChip(job.status);
  const metaSpan = el('span', 'job-card__meta', `${job.weeklyHours}h / week`);
  header.appendChild(title);
  header.appendChild(chip);
  header.appendChild(metaSpan);
  page.appendChild(header);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = document.createElement('div');
  tabs.className = 'tabs mt-5';

  const tabDefs = [
    { id: 'overview', label: 'Overview' },
    { id: 'weeks',    label: 'Weeks' },
    { id: 'months',   label: 'Months' },
    { id: 'sessions', label: 'Sessions' }
  ];

  const panels = {};
  for (const t of tabDefs) {
    const btn = document.createElement('button');
    btn.className = `tab-btn${_activeTab === t.id ? ' active' : ''}`;
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      _activeTab = t.id;
      renderJobDetail(jobId);
    });
    tabs.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = `tab-panel${_activeTab === t.id ? ' active' : ''}`;
    panels[t.id] = panel;
  }

  page.appendChild(tabs);

  // ── Tab content ───────────────────────────────────────────────────────────
  const todayStr = today();

  if (_activeTab === 'overview') {
    page.appendChild(_renderOverview(job, todayStr));
  } else if (_activeTab === 'weeks') {
    page.appendChild(_renderWeeks(job, todayStr));
  } else if (_activeTab === 'months') {
    page.appendChild(_renderMonths(job, todayStr));
  } else if (_activeTab === 'sessions') {
    page.appendChild(_renderSessions(job, jobId, todayStr));
  }
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function _renderOverview(job, todayStr) {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-5';

  const sessions = getJobSessions(job.id);
  const firstDay = jobFirstDay(job);
  const lastDay  = jobLastDay(job, todayStr);
  const dayMap   = workedHoursByDay(sessions);

  // Whole-job stats
  if (firstDay) {
    const stats = rangeStats(job, sessions, firstDay, lastDay, todayStr, dayMap);
    const statsCard = document.createElement('div');
    statsCard.className = 'card';
    const t = el('div', 'card__title', 'All-time Summary');
    statsCard.appendChild(t);

    const rows = [
      ['Total Required', formatDuration(stats.requiredHours)],
      ['Total Worked',   formatDuration(stats.workedHours)],
      ['Balance',        formatDuration(stats.balance, true)]
    ];

    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'job-card__stat-row';
      row.appendChild(el('span', 'job-card__stat-label', label));
      const v = el('span', 'job-card__stat-value mono', value);
      if (label === 'Balance') {
        v.className += stats.balance >= 0 ? ' positive' : ' negative';
      }
      row.appendChild(v);
      statsCard.appendChild(row);
    }

    wrap.appendChild(statsCard);
  }

  // Active periods
  const periodsCard = document.createElement('div');
  periodsCard.className = 'card';
  periodsCard.appendChild(el('div', 'card__title', 'Active Periods'));

  const periodsList = document.createElement('div');
  periodsList.className = 'periods-list mt-3';

  for (let i = 0; i < job.periods.length; i++) {
    const p = job.periods[i];
    const item = document.createElement('div');
    item.className = 'period-item';
    const label = el('span', 'period-item__label', `Period ${i + 1}`);
    const startEl = el('span', null, formatDate(p.start));
    const sep = el('span', null, '→');
    const endEl = el('span', null, p.end ? formatDate(p.end) : 'Now');
    item.appendChild(label);
    item.appendChild(startEl);
    item.appendChild(sep);
    item.appendChild(endEl);
    periodsList.appendChild(item);
  }

  periodsCard.appendChild(periodsList);
  wrap.appendChild(periodsCard);

  // Edit job form
  const editCard = document.createElement('div');
  editCard.className = 'card';
  editCard.appendChild(el('div', 'card__title', 'Edit Job'));

  const editForm = document.createElement('div');
  editForm.className = 'flex flex-col gap-4 mt-3';

  const nameInput = makeInput({ id: 'ej-name', value: job.name, required: true });
  const hoursInput = makeInput({ id: 'ej-hours', type: 'number', value: job.weeklyHours, min: '0.1', step: '0.5', required: true });

  editForm.appendChild(makeFormGroup('Job Name', nameInput));
  editForm.appendChild(makeFormGroup('Weekly Hours', hoursInput));

  const noteEl = el('p', null, 'Note: changing weekly hours applies to all weeks of this job.');
  noteEl.style.fontSize = '0.8rem';
  noteEl.style.opacity = '0.7';
  editForm.appendChild(noteEl);

  const saveBtn = makeButton('Save Changes', 'btn btn--yellow');
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const hours = parseFloat(hoursInput.value);
    if (!name) { showToast('Name is required.', 'error'); return; }
    if (!hours || hours <= 0) { showToast('Weekly hours must be > 0.', 'error'); return; }
    updateJob(job.id, { name, weeklyHours: hours });
    schedulePush();
    showToast('Job updated.', 'success');
    renderJobDetail(job.id);
  });
  editForm.appendChild(saveBtn);

  editCard.appendChild(editForm);
  wrap.appendChild(editCard);

  // Danger zone
  const danger = document.createElement('div');
  danger.className = 'card';
  danger.appendChild(el('div', 'card__title', 'Danger Zone'));
  const delBtn = makeButton('Delete Job', 'btn btn--red mt-3');
  delBtn.addEventListener('click', () => {
    confirm({
      title: 'Delete Job',
      message: `Permanently delete "${job.name}" and all its sessions? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmClass: 'btn--red',
      onConfirm: () => {
        deleteJob(job.id);
        schedulePush();
        showToast(`"${job.name}" deleted.`, 'info');
        window.location.hash = '#/';
      }
    });
  });
  danger.appendChild(delBtn);
  wrap.appendChild(danger);

  return wrap;
}

// ─── Weeks Tab ────────────────────────────────────────────────────────────────

function _renderWeeks(job, todayStr) {
  const sessions = getJobSessions(job.id);
  const dayMap = workedHoursByDay(sessions);
  const firstDay = jobFirstDay(job);
  if (!firstDay) return el('p', 'mt-4', 'No active periods yet.');

  const lastDay = jobLastDay(job, todayStr);
  const weeks = allWeeks(firstDay, lastDay, todayStr);

  let totalRequired = 0, totalWorked = 0;

  const wrap = document.createElement('div');
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'table';

  // Header
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  for (const col of ['Week', 'Active Days', 'Required', 'Worked', 'Remaining', 'Balance']) {
    const th = document.createElement('th');
    th.textContent = col;
    if (['Required','Worked','Remaining','Balance'].includes(col)) th.className = 'mono';
    hrow.appendChild(th);
  }
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (const w of weeks) {
    const stats = rangeStats(job, sessions, w.weekStart, w.weekEnd, todayStr, dayMap);
    totalRequired += stats.requiredHours;
    totalWorked   += stats.workedHours;

    const tr = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = `${formatDate(w.weekStart)} – ${formatDate(w.weekEnd)}`;

    _tdMono(tr, dateCell);
    _tdMono(tr, el('td', 'mono', String(stats.activeDays)));
    _tdMono(tr, el('td', 'mono', formatDuration(stats.requiredHours)));
    _tdMono(tr, el('td', 'mono', formatDuration(stats.workedHours)));

    const remTd = document.createElement('td');
    remTd.className = 'mono';
    remTd.textContent = stats.remaining < 0
      ? `+${formatDuration(Math.abs(stats.remaining))} OT`
      : formatDuration(stats.remaining);
    if (stats.remaining < 0) remTd.classList.add('positive');
    tr.appendChild(remTd);

    const balTd = document.createElement('td');
    balTd.className = 'mono';
    balTd.textContent = formatDuration(stats.balance, true);
    balTd.classList.add(stats.balance >= 0 ? 'positive' : 'negative');
    tr.appendChild(balTd);

    tbody.appendChild(tr);
  }

  // Total row
  const totalBalance = totalWorked - totalRequired;
  const totalRow = document.createElement('tr');
  totalRow.className = 'total-row';
  const totLabel = document.createElement('td');
  totLabel.textContent = 'TOTAL';
  totLabel.colSpan = 2;
  totalRow.appendChild(totLabel);
  totalRow.appendChild(el('td', 'mono', formatDuration(totalRequired)));
  totalRow.appendChild(el('td', 'mono', formatDuration(totalWorked)));
  totalRow.appendChild(el('td', 'mono', ''));
  const totBal = el('td', 'mono', formatDuration(totalBalance, true));
  totBal.classList.add(totalBalance >= 0 ? 'positive' : 'negative');
  totalRow.appendChild(totBal);
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  return wrap;
}

function _tdMono(tr, td) {
  tr.appendChild(td);
}

// ─── Months Tab ───────────────────────────────────────────────────────────────

function _renderMonths(job, todayStr) {
  const sessions = getJobSessions(job.id);
  const dayMap = workedHoursByDay(sessions);
  const firstDay = jobFirstDay(job);
  if (!firstDay) return el('p', 'mt-4', 'No active periods yet.');

  const lastDay = jobLastDay(job, todayStr);
  const months = allMonths(firstDay, lastDay, todayStr);

  let totalRequired = 0, totalWorked = 0;

  const wrap = document.createElement('div');
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'table';

  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  for (const col of ['Month', 'Active Days', 'Required', 'Worked', 'Balance']) {
    const th = document.createElement('th');
    th.textContent = col;
    if (['Required','Worked','Balance'].includes(col)) th.className = 'mono';
    hrow.appendChild(th);
  }
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (const mo of months) {
    const stats = rangeStats(job, sessions, mo.monthStart, mo.monthEnd, todayStr, dayMap);
    totalRequired += stats.requiredHours;
    totalWorked   += stats.workedHours;

    const tr = document.createElement('tr');
    const monthTd = document.createElement('td');
    monthTd.textContent = mo.label;
    tr.appendChild(monthTd);
    tr.appendChild(el('td', 'mono', String(stats.activeDays)));
    tr.appendChild(el('td', 'mono', formatDuration(stats.requiredHours)));
    tr.appendChild(el('td', 'mono', formatDuration(stats.workedHours)));
    const balTd = el('td', 'mono', formatDuration(stats.balance, true));
    balTd.classList.add(stats.balance >= 0 ? 'positive' : 'negative');
    tr.appendChild(balTd);
    tbody.appendChild(tr);
  }

  // Total row
  const totalBalance = totalWorked - totalRequired;
  const totalRow = document.createElement('tr');
  totalRow.className = 'total-row';
  const totLabel = document.createElement('td');
  totLabel.textContent = 'TOTAL';
  totLabel.colSpan = 2;
  totalRow.appendChild(totLabel);
  totalRow.appendChild(el('td', 'mono', formatDuration(totalRequired)));
  totalRow.appendChild(el('td', 'mono', formatDuration(totalWorked)));
  const totBal = el('td', 'mono', formatDuration(totalBalance, true));
  totBal.classList.add(totalBalance >= 0 ? 'positive' : 'negative');
  totalRow.appendChild(totBal);
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  return wrap;
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function _renderSessions(job, jobId, todayStr) {
  const sessions = getJobSessions(jobId).slice().sort((a, b) => b.start.localeCompare(a.start));

  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-4';

  // Add manual session button
  const addBtn = makeButton('+ Add Manual Session', 'btn btn--yellow');
  addBtn.addEventListener('click', () => _openSessionDialog(jobId, null, () => renderJobDetail(jobId)));
  wrap.appendChild(addBtn);

  if (sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.appendChild(el('div', 'empty-state__title', 'No sessions yet'));
    empty.appendChild(el('p', 'empty-state__text', 'Start the timer or add a manual session.'));
    wrap.appendChild(empty);
    return wrap;
  }

  // Sessions list
  const list = document.createElement('div');
  list.className = 'card';

  for (const session of sessions) {
    const item = document.createElement('div');
    item.className = 'session-item';

    const timeEl = document.createElement('div');
    timeEl.className = 'session-item__time';
    // Show date + time range
    const dateStr = toLocalDateStr(new Date(session.start));
    const tStart = formatTime(session.start);
    const tEnd   = formatTime(session.end);
    const dateLine = document.createElement('div');
    dateLine.textContent = formatDate(dateStr);
    dateLine.style.fontFamily = 'var(--font-body)';
    dateLine.style.fontWeight = '700';
    dateLine.style.fontSize = '0.8rem';
    const timeLine = document.createElement('div');
    timeLine.textContent = `${tStart} → ${tEnd}`;
    timeEl.appendChild(dateLine);
    timeEl.appendChild(timeLine);

    const noteEl = el('div', 'session-item__note', session.note || '—');

    const durationSeconds = (new Date(session.end) - new Date(session.start)) / 1000;
    const hours = durationSeconds / 3600;
    const durationEl = el('div', 'session-item__duration', formatDuration(hours));

    const actionsEl = document.createElement('div');
    actionsEl.className = 'session-item__actions';

    const editBtn = makeButton('Edit', 'btn btn--sm');
    editBtn.addEventListener('click', () => _openSessionDialog(jobId, session, () => renderJobDetail(jobId)));

    const delBtn = makeButton('Del', 'btn btn--sm btn--red');
    delBtn.addEventListener('click', () => {
      confirm({
        title: 'Delete Session',
        message: 'Delete this session? This cannot be undone.',
        confirmLabel: 'Delete',
        confirmClass: 'btn--red',
        onConfirm: () => {
          deleteSession(session.id);
          schedulePush();
          showToast('Session deleted.', 'info');
          renderJobDetail(jobId);
        }
      });
    });

    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(delBtn);

    item.appendChild(timeEl);
    item.appendChild(noteEl);
    item.appendChild(durationEl);
    item.appendChild(actionsEl);
    list.appendChild(item);
  }

  wrap.appendChild(list);
  return wrap;
}

function _openSessionDialog(jobId, session, onDone) {
  const isNew = !session;
  const todayStr = today();

  // Date field
  const startDateVal = session ? toLocalDateStr(new Date(session.start)) : todayStr;
  const startDateInput = makeInput({ id: 'sess-sdate', type: 'date', value: startDateVal, required: true });

  // Start/end time fields
  const startTimeVal = session ? _isoToTimeStr(session.start) : '09:00';
  const endTimeVal   = session ? _isoToTimeStr(session.end)   : '10:00';
  const startTimeInput = makeInput({ id: 'sess-stime', type: 'time', value: startTimeVal, required: true });
  const endTimeInput   = makeInput({ id: 'sess-etime', type: 'time', value: endTimeVal,   required: true });

  const noteInput = makeTextarea({ id: 'sess-note', value: session?.note || '', placeholder: 'Optional note' });
  const errorEl = el('p', 'form-error', '');

  const form = document.createElement('div');
  form.className = 'flex flex-col gap-4';
  form.appendChild(makeFormGroup('Date', startDateInput));
  form.appendChild(makeFormGroup('Start Time', startTimeInput));
  form.appendChild(makeFormGroup('End Time', endTimeInput));
  form.appendChild(makeFormGroup('Note', noteInput));
  form.appendChild(errorEl);

  const { close } = showModal({
    title: isNew ? 'Add Session' : 'Edit Session',
    body: form,
    confirmLabel: isNew ? 'Add' : 'Save',
    confirmClass: 'btn--yellow',
    onConfirm: () => {
      const dateStr  = startDateInput.value;
      const startStr = startTimeInput.value;
      const endStr   = endTimeInput.value;
      const note     = noteInput.value.trim();

      if (!dateStr || !startStr || !endStr) {
        errorEl.textContent = 'All time fields are required.'; return;
      }

      const startISO = localDateTimeToISO(dateStr, startStr);
      const endISO   = localDateTimeToISO(dateStr, endStr);

      if (new Date(endISO) <= new Date(startISO)) {
        // Allow end next day: re-parse end as next day if end time < start time
        const [ey, em, ed] = dateStr.split('-').map(Number);
        const [eh, emin] = endStr.split(':').map(Number);
        const [sh, smin] = startStr.split(':').map(Number);
        if (eh * 60 + emin < sh * 60 + smin) {
          // end is next day
          const endDateObj = new Date(ey, em - 1, ed + 1, eh, emin, 0, 0);
          const endISOFixed = endDateObj.toISOString();
          _saveSession(isNew, session, jobId, startISO, endISOFixed, note, close, onDone, errorEl);
          return;
        }
        errorEl.textContent = 'End time must be after start time.'; return;
      }

      _saveSession(isNew, session, jobId, startISO, endISO, note, close, onDone, errorEl);
    }
  });
}

function _saveSession(isNew, session, jobId, startISO, endISO, note, close, onDone, errorEl) {
  if (isNew) {
    addSession({ jobId, start: startISO, end: endISO, note });
    showToast('Session added.', 'success');
  } else {
    updateSession(session.id, { start: startISO, end: endISO, note });
    showToast('Session updated.', 'success');
  }
  schedulePush();
  close();
  onDone();
}

function _isoToTimeStr(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
