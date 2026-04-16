/**
 * Storage module for Tab Guard.
 * The ONLY module that interacts with chrome.storage.local.
 *
 * Manages three storage keys:
 *   tg_snapshots      – current window snapshots (upserted on browser events)
 *   tg_closed_windows – recently closed windows (prepended on window close)
 *   tg_settings       – user preferences
 */

const SNAPSHOTS_KEY = 'tg_snapshots';
const CLOSED_KEY = 'tg_closed_windows';
const SETTINGS_KEY = 'tg_settings';

/** Default settings */
const DEFAULT_SETTINGS = {
  autoSaveInterval: 2,     // seconds (debounce)
  retentionDays: 30,       // days to keep history
  lazyLoading: true,       // discard tabs on restore
  restoreGroups: true,     // recreate tab groups on restore
  showGroupBadges: true,   // show group badges in UI
};

// ── Snapshots ────────────────────────────────────────

/**
 * Persists a window snapshot.
 * If a snapshot with the same windowId already exists it is replaced in-place;
 * otherwise the snapshot is appended to the list.
 */
export async function saveSnapshot(snapshot) {
  const data = await chrome.storage.local.get([SNAPSHOTS_KEY]);
  const snapshots = data[SNAPSHOTS_KEY] || [];
  const existingIndex = snapshots.findIndex((s) => s.windowId === snapshot.windowId);
  if (existingIndex >= 0) {
    snapshots[existingIndex] = snapshot;
  } else {
    snapshots.push(snapshot);
  }
  await chrome.storage.local.set({ [SNAPSHOTS_KEY]: snapshots });
}

/**
 * Returns all stored window snapshots.
 */
export async function getSnapshots() {
  const data = await chrome.storage.local.get([SNAPSHOTS_KEY]);
  return data[SNAPSHOTS_KEY] || [];
}

// ── Closed Windows ───────────────────────────────────

/**
 * Prepends a closed-window snapshot to the closed-windows list.
 */
export async function addClosedWindow(snapshot) {
  const data = await chrome.storage.local.get([CLOSED_KEY]);
  const closed = data[CLOSED_KEY] || [];
  closed.unshift(snapshot);
  await chrome.storage.local.set({ [CLOSED_KEY]: closed });
}

/**
 * Returns all stored closed-window snapshots (newest first).
 */
export async function getClosedWindows() {
  const data = await chrome.storage.local.get([CLOSED_KEY]);
  return data[CLOSED_KEY] || [];
}

// ── Cleanup ──────────────────────────────────────────

/**
 * Removes snapshots and closed-window entries older than maxDays days.
 */
export async function removeOldSnapshots(maxDays) {
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  const data = await chrome.storage.local.get([SNAPSHOTS_KEY, CLOSED_KEY]);
  const snapshots = (data[SNAPSHOTS_KEY] || []).filter((s) => s.timestamp >= cutoff);
  const closed = (data[CLOSED_KEY] || []).filter((s) => s.timestamp >= cutoff);
  await chrome.storage.local.set({ [SNAPSHOTS_KEY]: snapshots, [CLOSED_KEY]: closed });
}

/**
 * Clears all history (snapshots + closed windows).
 */
export async function clearAllHistory() {
  await chrome.storage.local.set({ [SNAPSHOTS_KEY]: [], [CLOSED_KEY]: [] });
}

// ── Storage Info ─────────────────────────────────────

/**
 * Returns the approximate number of bytes currently used.
 */
export async function getStorageUsage() {
  const bytes = await chrome.storage.local.getBytesInUse();
  return bytes;
}

// ── Settings ─────────────────────────────────────────

/**
 * Returns current settings merged with defaults.
 */
export async function getSettings() {
  const data = await chrome.storage.local.get([SETTINGS_KEY]);
  return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
}

/**
 * Saves a partial settings update (merged with existing).
 */
export async function saveSettings(partial) {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}

/**
 * Returns the default settings object.
 */
export function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}
