/**
 * state.js — In-memory store, mutations, updatedAt handling.
 *
 * Consumers import `state` (read) and mutation functions (write).
 * Every mutation sets `updatedAt` and triggers onChange callbacks.
 */

import { uuid, today } from './utils.js';

/** @type {{ version: number, jobs: object[], sessions: object[] }} */
export const state = {
  version: 1,
  jobs: [],
  sessions: []
};

/** Registered change listeners */
const listeners = [];

/**
 * Register a callback to be called after any state mutation.
 * @param {Function} fn
 */
export function onChange(fn) {
  listeners.push(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

/**
 * Replace entire state from a parsed data object (e.g., from GitHub or cache).
 */
export function loadState(data) {
  state.version = data.version ?? 1;
  state.jobs = data.jobs ?? [];
  state.sessions = data.sessions ?? [];
  notify();
}

/** Serialize state to a plain object (for saving). */
export function serializeState() {
  return {
    version: state.version,
    jobs: state.jobs,
    sessions: state.sessions
  };
}

// ─── Job mutations ────────────────────────────────────────────────────────────

/**
 * Create a new job.
 * @param {{ name: string, weeklyHours: number, startDate: string }} opts
 */
export function createJob({ name, weeklyHours, startDate }) {
  const now = new Date().toISOString();
  const job = {
    id: uuid(),
    name,
    weeklyHours: Number(weeklyHours),
    status: 'active',
    periods: [{ start: startDate, end: null }],
    timer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
  state.jobs.push(job);
  notify();
  return job;
}

/**
 * Update job fields (name, weeklyHours).
 */
export function updateJob(id, fields) {
  const job = getJob(id);
  if (!job) return;
  if (fields.name !== undefined) job.name = fields.name;
  if (fields.weeklyHours !== undefined) job.weeklyHours = Number(fields.weeklyHours);
  job.updatedAt = new Date().toISOString();
  notify();
}

/**
 * Soft-delete a job and its sessions.
 */
export function deleteJob(id) {
  const now = new Date().toISOString();
  const job = getJob(id);
  if (!job) return;
  // Stop timer if running
  if (job.timer) {
    stopTimer(id);
  }
  job.deletedAt = now;
  job.updatedAt = now;
  // Also soft-delete all sessions
  for (const s of state.sessions) {
    if (s.jobId === id && !s.deletedAt) {
      s.deletedAt = now;
      s.updatedAt = now;
    }
  }
  notify();
}

/**
 * Pause a job. If timer is running, stop it first (saves session).
 */
export function pauseJob(id) {
  const job = getJob(id);
  if (!job || job.status !== 'active') return;
  if (job.timer) _stopTimerInternal(job);
  const todayStr = today();
  _closePeriod(job, todayStr);
  job.status = 'paused';
  job.updatedAt = new Date().toISOString();
  notify();
}

/**
 * End a job. If timer is running, stop it first (saves session).
 */
export function endJob(id) {
  const job = getJob(id);
  if (!job || job.status === 'ended') return;
  if (job.timer) _stopTimerInternal(job);
  const todayStr = today();
  _closePeriod(job, todayStr);
  job.status = 'ended';
  job.updatedAt = new Date().toISOString();
  notify();
}

/**
 * Resume a paused job, or reopen an ended job.
 */
export function resumeJob(id) {
  const job = getJob(id);
  if (!job || job.status === 'active') return;
  const todayStr = today();
  // If the last period ended today, reopen it instead of adding a new overlapping one
  const lastPeriod = job.periods[job.periods.length - 1];
  if (lastPeriod && lastPeriod.end === todayStr) {
    lastPeriod.end = null;
  } else {
    job.periods.push({ start: todayStr, end: null });
  }
  job.status = 'active';
  job.updatedAt = new Date().toISOString();
  notify();
}

// ─── Timer mutations ──────────────────────────────────────────────────────────

/**
 * Start the timer for a job.
 */
export function startTimer(id) {
  const job = getJob(id);
  if (!job || job.status !== 'active' || job.timer) return;
  job.timer = { startedAt: new Date().toISOString() };
  job.updatedAt = new Date().toISOString();
  notify();
}

/**
 * Stop the timer for a job, creating a session.
 * @returns {{ elapsedSeconds: number, session: object|null }}
 */
export function stopTimer(id) {
  const job = getJob(id);
  if (!job || !job.timer) return { elapsedSeconds: 0, session: null };
  return _stopTimerInternal(job);
}

function _stopTimerInternal(job) {
  const now = new Date();
  const startedAt = new Date(job.timer.startedAt);
  const elapsedSeconds = (now - startedAt) / 1000;

  const session = _createSessionRecord(job.id, job.timer.startedAt, now.toISOString(), '');
  job.timer = null;
  job.updatedAt = now.toISOString();
  return { elapsedSeconds, session };
}

// ─── Session mutations ────────────────────────────────────────────────────────

/**
 * Add a manual session.
 * @param {{ jobId, start, end, note }} opts
 */
export function addSession({ jobId, start, end, note }) {
  const session = _createSessionRecord(jobId, start, end, note || '');
  notify();
  return session;
}

/**
 * Update a session's start, end, or note.
 */
export function updateSession(id, fields) {
  const session = getSession(id);
  if (!session) return;
  if (fields.start !== undefined) session.start = fields.start;
  if (fields.end !== undefined) session.end = fields.end;
  if (fields.note !== undefined) session.note = fields.note;
  session.updatedAt = new Date().toISOString();
  notify();
}

/**
 * Soft-delete a session.
 */
export function deleteSession(id) {
  const session = getSession(id);
  if (!session) return;
  const now = new Date().toISOString();
  session.deletedAt = now;
  session.updatedAt = now;
  notify();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _createSessionRecord(jobId, start, end, note) {
  const now = new Date().toISOString();
  const session = {
    id: uuid(),
    jobId,
    start,
    end,
    note: note || '',
    updatedAt: now,
    deletedAt: null
  };
  state.sessions.push(session);
  return session;
}

function _closePeriod(job, todayStr) {
  const last = job.periods[job.periods.length - 1];
  if (last && last.end === null) {
    last.end = todayStr;
  }
}

/** Get a live job by id (not soft-deleted). */
export function getJob(id) {
  return state.jobs.find(j => j.id === id && !j.deletedAt) || null;
}

/** Get all live jobs. */
export function getLiveJobs() {
  return state.jobs.filter(j => !j.deletedAt);
}

/** Get sessions for a job (not soft-deleted). */
export function getJobSessions(jobId) {
  return state.sessions.filter(s => s.jobId === jobId && !s.deletedAt);
}

/** Get a session by id. */
export function getSession(id) {
  return state.sessions.find(s => s.id === id) || null;
}

/**
 * Merge incoming data (from GitHub) with current in-memory state.
 * Union by id; keep the record with the later updatedAt.
 */
export function mergeState(incoming) {
  function mergeArray(local, remote) {
    const map = new Map();
    for (const item of local) map.set(item.id, item);
    for (const item of remote) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        const existing = map.get(item.id);
        if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
          map.set(item.id, item);
        }
      }
    }
    return Array.from(map.values());
  }

  state.jobs = mergeArray(state.jobs, incoming.jobs || []);
  state.sessions = mergeArray(state.sessions, incoming.sessions || []);
  notify();
}
