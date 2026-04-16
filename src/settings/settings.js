import { getSettings, saveSettings, getDefaultSettings, getStorageUsage, clearAllHistory } from '../storage.js';

// ── DOM References ───────────────────────────────────

const autoSaveEl = document.getElementById('auto-save-interval');
const retentionEl = document.getElementById('retention-days');
const lazyEl = document.getElementById('lazy-loading');
const groupsEl = document.getElementById('restore-groups');
const badgesEl = document.getElementById('show-group-badges');
const storageUsageEl = document.getElementById('storage-usage');
const storageFillEl = document.getElementById('storage-fill');
const clearAllBtn = document.getElementById('clear-all');
const resetBtn = document.getElementById('reset-settings');

// ── Load Settings ────────────────────────────────────

async function loadSettings() {
  const settings = await getSettings();

  autoSaveEl.value = String(settings.autoSaveInterval);
  retentionEl.value = String(settings.retentionDays);
  lazyEl.checked = settings.lazyLoading;
  groupsEl.checked = settings.restoreGroups;
  badgesEl.checked = settings.showGroupBadges;
}

// ── Auto-Save on Change ──────────────────────────────

function onChange(key, valueFn) {
  return async () => {
    await saveSettings({ [key]: valueFn() });
  };
}

autoSaveEl.addEventListener('change', onChange('autoSaveInterval', () => Number(autoSaveEl.value)));
retentionEl.addEventListener('change', onChange('retentionDays', () => Number(retentionEl.value)));
lazyEl.addEventListener('change', onChange('lazyLoading', () => lazyEl.checked));
groupsEl.addEventListener('change', onChange('restoreGroups', () => groupsEl.checked));
badgesEl.addEventListener('change', onChange('showGroupBadges', () => badgesEl.checked));

// ── Storage Info ─────────────────────────────────────

async function updateStorageInfo() {
  const bytes = await getStorageUsage();
  const kb = (bytes / 1024).toFixed(1);
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  const maxBytes = 10 * 1024 * 1024;
  const percent = Math.min((bytes / maxBytes) * 100, 100);

  const display = bytes > 1024 * 1024
    ? `${mb} MB von 10 MB (${percent.toFixed(1)}%)`
    : `${kb} KB von 10 MB`;

  storageUsageEl.textContent = display;
  storageFillEl.style.width = `${percent}%`;
}

// ── Actions ──────────────────────────────────────────

clearAllBtn.addEventListener('click', async () => {
  const confirmed = confirm('Komplette History l\u00F6schen? Das kann nicht r\u00FCckg\u00E4ngig gemacht werden.');
  if (!confirmed) return;

  await clearAllHistory();
  updateStorageInfo();
});

resetBtn.addEventListener('click', async () => {
  const confirmed = confirm('Alle Einstellungen auf Standard zur\u00FCcksetzen?');
  if (!confirmed) return;

  const defaults = getDefaultSettings();
  await saveSettings(defaults);
  loadSettings();
});

// ── Init ─────────────────────────────────────────────

loadSettings();
updateStorageInfo();
