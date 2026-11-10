/**
 * ui/settings.js — Settings page (#/settings)
 */

import {
  loadSettings, saveSettings, clearToken, testConnection,
  exportJSON, importJSON, schedulePush, syncFromRemote
} from '../storage.js';
import { showToast, makeButton, makeFormGroup, makeInput, el, clearEl } from './components.js';

export function renderSettings() {
  const page = document.getElementById('page-settings');
  clearEl(page);

  const heading = el('h2', 'section-heading', 'Settings');
  page.appendChild(heading);

  // ── GitHub Sync ───────────────────────────────────────────────────────────
  const syncCard = document.createElement('div');
  syncCard.className = 'card';
  syncCard.appendChild(el('div', 'card__title', 'GitHub Sync'));

  // Help text
  const help = document.createElement('div');
  help.className = 'callout mt-3';
  help.appendChild(el('div', 'callout__title', 'How to set up'));
  const helpLines = [
    '1. Create a private GitHub repository (e.g. "hours-data").',
    '2. Go to GitHub → Settings → Developer settings → Fine-grained personal access tokens.',
    '3. Create a token with access to only that repository, with Contents: Read and write permission.',
    '4. Enter your details below and click Test Connection.'
  ];
  for (const line of helpLines) {
    const p = el('p', null, line);
    p.style.marginTop = '4px';
    p.style.fontSize = '0.85rem';
    help.appendChild(p);
  }
  syncCard.appendChild(help);

  const settings = loadSettings() || {};

  const ownerInput  = makeInput({ id: 'cfg-owner',  value: settings.owner    || '', placeholder: 'your-github-username' });
  const repoInput   = makeInput({ id: 'cfg-repo',   value: settings.repo     || '', placeholder: 'hours-data' });
  const branchInput = makeInput({ id: 'cfg-branch', value: settings.branch   || 'main', placeholder: 'main' });
  const pathInput   = makeInput({ id: 'cfg-path',   value: settings.filePath || 'data.json', placeholder: 'data.json' });
  const tokenInput  = makeInput({ id: 'cfg-token',  type: 'password', value: settings.token || '', placeholder: 'github_pat_...' });

  const form = document.createElement('div');
  form.className = 'flex flex-col gap-4 mt-4';
  form.appendChild(makeFormGroup('GitHub Owner / Username', ownerInput));
  form.appendChild(makeFormGroup('Repository Name', repoInput));
  form.appendChild(makeFormGroup('Branch', branchInput));
  form.appendChild(makeFormGroup('File Path', pathInput));
  form.appendChild(makeFormGroup('Personal Access Token', tokenInput));

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'flex gap-3 wrap mt-2';

  const testBtn = makeButton('Test Connection', 'btn btn--blue');
  const saveBtn = makeButton('Save', 'btn btn--yellow');
  const clearTokBtn = makeButton('Clear Token from Device', 'btn btn--sm');

  const statusEl = el('p', null, '');
  statusEl.style.fontWeight = '700';
  statusEl.style.marginTop = 'var(--s2)';

  testBtn.addEventListener('click', async () => {
    _applyInputs(ownerInput, repoInput, branchInput, pathInput, tokenInput);
    testBtn.disabled = true;
    testBtn.textContent = 'Testing…';
    const result = await testConnection();
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
    statusEl.textContent = result.message;
    statusEl.style.color = result.ok ? 'green' : 'red';
    if (result.ok) showToast(result.message, 'success');
    else showToast(result.message, 'error');
  });

  saveBtn.addEventListener('click', () => {
    _applyInputs(ownerInput, repoInput, branchInput, pathInput, tokenInput);
    showToast('Settings saved.', 'success');
    statusEl.textContent = '';
  });

  clearTokBtn.addEventListener('click', () => {
    clearToken();
    tokenInput.value = '';
    showToast('Token cleared from this device.', 'info');
  });

  btnRow.appendChild(testBtn);
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(clearTokBtn);
  form.appendChild(btnRow);
  form.appendChild(statusEl);

  syncCard.appendChild(form);
  page.appendChild(syncCard);

  // ── Refresh / Sync ────────────────────────────────────────────────────────
  const syncCard2 = document.createElement('div');
  syncCard2.className = 'card mt-5';
  syncCard2.appendChild(el('div', 'card__title', 'Manual Sync'));

  const refreshBtn = makeButton('Force Refresh from GitHub', 'btn btn--blue mt-3');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing…';
    await syncFromRemote();
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Force Refresh from GitHub';
    showToast('Synced from GitHub.', 'success');
  });
  syncCard2.appendChild(refreshBtn);
  page.appendChild(syncCard2);

  // ── Export / Import ───────────────────────────────────────────────────────
  const dataCard = document.createElement('div');
  dataCard.className = 'card mt-5';
  dataCard.appendChild(el('div', 'card__title', 'Export / Import'));

  const dataRow = document.createElement('div');
  dataRow.className = 'flex gap-3 wrap mt-3';

  const exportBtn = makeButton('Export JSON', 'btn btn--green');
  exportBtn.addEventListener('click', () => {
    exportJSON();
    showToast('Export downloaded.', 'success');
  });

  const importLabel = document.createElement('label');
  importLabel.className = 'btn';
  importLabel.textContent = 'Import JSON';
  const importFile = document.createElement('input');
  importFile.type = 'file';
  importFile.accept = 'application/json,.json';
  importFile.style.display = 'none';
  importFile.addEventListener('change', async () => {
    if (!importFile.files?.length) return;
    const file = importFile.files[0];
    // Confirm before overwrite
    if (!confirm('Import will replace all current data. Continue?')) {
      importFile.value = '';
      return;
    }
    try {
      await importJSON(file);
      showToast('Import successful!', 'success');
      window.location.hash = '#/';
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
    importFile.value = '';
  });
  importLabel.appendChild(importFile);

  dataRow.appendChild(exportBtn);
  dataRow.appendChild(importLabel);
  dataCard.appendChild(dataRow);
  page.appendChild(dataCard);
}

function _applyInputs(ownerInput, repoInput, branchInput, pathInput, tokenInput) {
  saveSettings({
    owner:    ownerInput.value.trim(),
    repo:     repoInput.value.trim(),
    branch:   branchInput.value.trim() || 'main',
    filePath: pathInput.value.trim() || 'data.json',
    token:    tokenInput.value.trim()
  });
}

