/**
 * app.js — Bootstrap, routing, global state, event wiring.
 */

import { loadState, getLiveJobs } from './state.js';
import { loadCache, hasSettings, onSyncChange, syncFromRemote, schedulePush } from './storage.js';
import { onTick, syncTimers } from './timer.js';
import { renderDashboard, updateTimerDisplay, clearTimerDisplay } from './ui/dashboard.js';
import { renderJobDetail } from './ui/jobDetail.js';
import { renderSettings } from './ui/settings.js';

// ─── Global app context (accessible to other modules) ────────────────────────
window.__app__ = {
  hasSettings
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Load from cache immediately so UI is fast
  const cached = loadCache();
  if (cached) loadState(cached);

  // Setup sync indicator
  _initSyncIndicator();

  // Setup hash routing
  window.addEventListener('hashchange', _route);
  _route();

  // Wire up header buttons
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await syncFromRemote();
    _route();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    window.location.hash = '#/settings';
  });

  document.getElementById('btn-dashboard').addEventListener('click', () => {
    window.location.hash = '#/';
  });

  // Re-sync when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncFromRemote().then(() => {
        syncTimers(getLiveJobs());
        _route();
      });
    }
  });

  // Initial remote fetch
  if (hasSettings()) {
    syncFromRemote().then(() => {
      syncTimers(getLiveJobs());
      _route();
    });
  }

  // Wire up timer tick → update timer displays
  onTick((jobId, elapsedSeconds) => {
    if (elapsedSeconds > 0) {
      updateTimerDisplay(jobId, elapsedSeconds);
    } else {
      clearTimerDisplay(jobId);
    }
  });
});

// ─── Routing ──────────────────────────────────────────────────────────────────

function _route() {
  const hash = window.location.hash || '#/';

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (hash === '#/' || hash === '') {
    document.getElementById('page-dashboard').classList.add('active');
    renderDashboard();
  } else if (hash === '#/settings') {
    document.getElementById('page-settings').classList.add('active');
    renderSettings();
  } else if (hash.startsWith('#/job/')) {
    const jobId = hash.slice(6);
    document.getElementById('page-job').classList.add('active');
    renderJobDetail(jobId);
  } else {
    // 404 — go home
    window.location.hash = '#/';
  }
}

// ─── Sync indicator ───────────────────────────────────────────────────────────

function _initSyncIndicator() {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;

  onSyncChange((status, error) => {
    indicator.className = `sync-indicator ${status}`;
    if (status === 'saved')  indicator.textContent = 'SAVED';
    if (status === 'saving') indicator.textContent = 'SAVING…';
    if (status === 'error') {
      indicator.textContent = 'SYNC ERROR — RETRY';
      indicator.title = error || '';
      indicator.onclick = () => {
        schedulePush();
      };
    }
  });

  if (!hasSettings()) {
    indicator.className = 'sync-indicator offline';
    indicator.textContent = 'LOCAL ONLY';
  }
}
