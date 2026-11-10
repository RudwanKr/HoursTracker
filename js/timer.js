/**
 * timer.js — Start/stop logic, live ticking, multiple jobs in parallel.
 */

import { startTimer, stopTimer, getJob } from './state.js';
import { schedulePush } from './storage.js';
import { formatHMS } from './utils.js';

/** Map of jobId → setInterval handle for live-ticking jobs. */
const _intervals = new Map();

/** Registered tick callbacks: (jobId, elapsedSeconds) → void */
const _tickListeners = [];

export function onTick(fn) {
  _tickListeners.push(fn);
}

function notifyTick(jobId, elapsedSeconds) {
  for (const fn of _tickListeners) fn(jobId, elapsedSeconds);
}

/**
 * Start the timer for a job and begin live ticking.
 */
export function timerStart(jobId) {
  const job = getJob(jobId);
  if (!job || job.status !== 'active' || job.timer) return;
  startTimer(jobId);
  schedulePush();
  _beginTicking(jobId);
}

/**
 * Stop the timer for a job.
 * @param {boolean} [force=false] - skip short-session check
 * @returns {{ elapsedSeconds: number, session: object|null, tooShort: boolean }}
 */
export function timerStop(jobId, force = false) {
  const job = getJob(jobId);
  if (!job || !job.timer) return { elapsedSeconds: 0, session: null, tooShort: false };

  const elapsed = (Date.now() - new Date(job.timer.startedAt)) / 1000;

  if (!force && elapsed < 5) {
    return { elapsedSeconds: elapsed, session: null, tooShort: true };
  }

  _stopTicking(jobId);
  const result = stopTimer(jobId);
  schedulePush();
  return { ...result, tooShort: false };
}

/**
 * Resume ticking for all jobs that have timers (called on app load).
 */
export function resumeAllTimers() {
  // Will be called by app.js with the current job list
}

/**
 * Ensure ticking is active for all jobs that have a timer running.
 * @param {object[]} jobs
 */
export function syncTimers(jobs) {
  const runningIds = new Set();
  for (const job of jobs) {
    if (job.timer && !job.deletedAt) {
      runningIds.add(job.id);
      if (!_intervals.has(job.id)) {
        _beginTicking(job.id);
      }
    }
  }
  // Stop ticking jobs whose timer was cleared remotely
  for (const [id] of _intervals) {
    if (!runningIds.has(id)) _stopTicking(id);
  }
}

/**
 * Get current elapsed seconds for a running job, or 0 if not running.
 */
export function getElapsed(job) {
  if (!job.timer) return 0;
  return (Date.now() - new Date(job.timer.startedAt)) / 1000;
}

/**
 * Format a job's current elapsed time as HH:MM:SS.
 */
export function getTimerDisplay(job) {
  return formatHMS(getElapsed(job));
}

function _beginTicking(jobId) {
  if (_intervals.has(jobId)) return;
  const handle = setInterval(() => {
    const job = getJob(jobId);
    if (!job || !job.timer) {
      _stopTicking(jobId);
      return;
    }
    const elapsed = getElapsed(job);
    notifyTick(jobId, elapsed);
  }, 1000);
  _intervals.set(jobId, handle);
}

function _stopTicking(jobId) {
  const handle = _intervals.get(jobId);
  if (handle !== undefined) {
    clearInterval(handle);
    _intervals.delete(jobId);
  }
  notifyTick(jobId, 0);
}

