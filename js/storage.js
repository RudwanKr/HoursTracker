/**
 * storage.js — localStorage cache, GitHub API client, merge, migrate.
 */

import { encodeBase64, decodeBase64 } from './utils.js';
import { serializeState, mergeState, loadState } from './state.js';

const SETTINGS_KEY = 'hoursTracker.settings';
const CACHE_KEY    = 'hoursTracker.cache';

// ─── Settings ─────────────────────────────────────────────────────────────────

/** @returns {{ owner, repo, branch, filePath, token } | null} */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @param {{ owner, repo, branch, filePath, token }} settings */
export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearToken() {
  const s = loadSettings();
  if (s) {
    delete s.token;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }
}

export function hasSettings() {
  const s = loadSettings();
  return !!(s && s.owner && s.repo && s.token);
}

// ─── localStorage cache ───────────────────────────────────────────────────────

export function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — silently ignore */ }
}

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Migration ────────────────────────────────────────────────────────────────

/**
 * migrate(data) — currently a pass-through. Reserved for future schema changes.
 * @param {object} data
 * @returns {object}
 */
export function migrate(data) {
  // v1: nothing to do
  return data;
}

// ─── GitHub API client ────────────────────────────────────────────────────────

/** Current known SHA of data.json on GitHub. Updated after each read/write. */
let _currentSha = null;

function apiUrl(settings) {
  const { owner, repo, filePath, branch } = settings;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
}

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

/**
 * Fetch data.json from GitHub.
 * @returns {{ data: object, sha: string } | null}
 * @throws on network or auth errors
 */
export async function fetchRemote() {
  const settings = loadSettings();
  if (!settings || !settings.token) throw new Error('No settings configured.');

  const resp = await fetch(apiUrl(settings), { headers: headers(settings.token) });

  if (resp.status === 404) {
    // File doesn't exist yet — return empty data
    _currentSha = null;
    return { data: { version: 1, jobs: [], sessions: [] }, sha: null };
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new GithubError(resp.status, body.message || resp.statusText);
  }

  const json = await resp.json();
  _currentSha = json.sha;
  const decoded = decodeBase64(json.content.replace(/\n/g, ''));
  const data = migrate(JSON.parse(decoded));
  return { data, sha: json.sha };
}

/**
 * Push data.json to GitHub.
 * @param {object} data - the full data object to serialize
 * @param {string} [sha] - current sha (omit for first-time creation)
 * @throws on network/auth/conflict errors
 */
export async function pushRemote(data, sha) {
  const settings = loadSettings();
  if (!settings || !settings.token) throw new Error('No settings configured.');

  const content = encodeBase64(JSON.stringify(data, null, 2));
  const body = {
    message: `hours-tracker: sync ${new Date().toISOString()}`,
    content,
    branch: settings.branch || 'main'
  };
  if (sha) body.sha = sha;

  const resp = await fetch(
    `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${settings.filePath}`,
    {
      method: 'PUT',
      headers: { ...headers(settings.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!resp.ok) {
    const respBody = await resp.json().catch(() => ({}));
    throw new GithubError(resp.status, respBody.message || resp.statusText);
  }

  const json = await resp.json();
  _currentSha = json.content?.sha ?? null;
  return _currentSha;
}

export function getCurrentSha() { return _currentSha; }
export function setCurrentSha(sha) { _currentSha = sha; }

// ─── Sync orchestration ───────────────────────────────────────────────────────

let _syncDebounceTimer = null;
let _syncListeners = [];
let _syncStatus = 'saved'; // 'saved' | 'saving' | 'error'
let _syncError = null;
let _retryCount = 0;
const MAX_RETRIES = 3;

export function getSyncStatus() { return { status: _syncStatus, error: _syncError }; }

export function onSyncChange(fn) { _syncListeners.push(fn); }

function notifySync(status, error = null) {
  _syncStatus = status;
  _syncError = error;
  for (const fn of _syncListeners) fn(status, error);
}

/**
 * Schedule a debounced push to GitHub (~500 ms).
 * Call this after every state mutation.
 */
export function schedulePush() {
  // Always update the cache immediately
  saveCache(serializeState());

  if (!hasSettings()) return; // no-op if not configured

  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => _doPush(), 500);
  notifySync('saving');
}

async function _doPush(retryCount = 0) {
  const data = serializeState();
  try {
    const sha = await pushRemote(data, _currentSha ?? undefined);
    _currentSha = sha;
    notifySync('saved');
    _retryCount = 0;
  } catch (err) {
    if ((err.status === 409 || err.status === 422) && retryCount < MAX_RETRIES) {
      // SHA mismatch: re-fetch, merge, retry
      try {
        const { data: remote, sha } = await fetchRemote();
        _currentSha = sha;
        mergeState(remote);
        saveCache(serializeState());
        await _doPush(retryCount + 1);
      } catch (mergeErr) {
        notifySync('error', friendlyError(mergeErr));
      }
    } else {
      notifySync('error', friendlyError(err));
    }
  }
}

/**
 * Load data from GitHub and merge into local state.
 * Shows cached data first; called on app load and visibilitychange.
 */
export async function syncFromRemote() {
  if (!hasSettings()) return;
  notifySync('saving');
  try {
    const { data, sha } = await fetchRemote();
    _currentSha = sha;
    mergeState(data);
    saveCache(serializeState());
    notifySync('saved');
  } catch (err) {
    notifySync('error', friendlyError(err));
  }
}

/**
 * Test the connection with current settings.
 * @returns {{ ok: boolean, message: string }}
 */
export async function testConnection() {
  try {
    await fetchRemote();
    return { ok: true, message: 'Connection successful! Repository found.' };
  } catch (err) {
    return { ok: false, message: friendlyError(err) };
  }
}

// ─── Error class ──────────────────────────────────────────────────────────────

class GithubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function friendlyError(err) {
  if (err instanceof GithubError) {
    if (err.status === 401) return 'Invalid or expired token. Check your GitHub token in Settings.';
    if (err.status === 403) return 'Permission denied. Ensure the token has Contents: Read and write.';
    if (err.status === 404) return 'Repository or file not found. Check owner/repo/path in Settings.';
    if (err.status === 409 || err.status === 422) return 'Sync conflict — retrying…';
    if (err.status === 429) return 'GitHub rate limit reached. Try again in a moment.';
    return `GitHub error (${err.status}): ${err.message}`;
  }
  if (!navigator.onLine) return 'No network connection.';
  return err.message || 'Unknown error.';
}

// ─── Export / Import ──────────────────────────────────────────────────────────

export function exportJSON() {
  const data = serializeState();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hours-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importJSON(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.version || !Array.isArray(data.jobs) || !Array.isArray(data.sessions)) {
    throw new Error('Invalid data format.');
  }
  const migrated = migrate(data);
  loadState(migrated);
  saveCache(migrated);
  schedulePush();
}

