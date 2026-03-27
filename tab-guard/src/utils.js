/**
 * Pure utility functions for Tab Guard.
 * No side effects, no Chrome API calls.
 */

/**
 * Generates a unique identifier string.
 * Uses crypto.randomUUID when available, falls back to timestamp + random.
 * @returns {string}
 */
export function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Formats a timestamp as a human-readable relative time string in German.
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'vor weniger als 1 Min.';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHrs < 24) return `vor ${diffHrs} Std.`;
  if (diffDays === 1) return 'vor 1 Tag';
  return `vor ${diffDays} Tagen`;
}

/**
 * Returns a date heading label in German for a given timestamp.
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} 'Heute', 'Gestern', or a German locale date string
 */
export function formatDateHeading(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Heute';
  if (isSameDay(date, yesterday)) return 'Gestern';

  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Deduplicates an array of window snapshots.
 * When two snapshots share the same windowId and identical tab URLs,
 * only the most recent one is kept.
 * @param {Array<{windowId: number, tabs: Array<{url: string}>, timestamp: number}>} snapshots
 * @returns {Array}
 */
export function deduplicateSnapshots(snapshots) {
  const sorted = [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Map();

  return sorted.filter((snap) => {
    const tabKey = snap.tabs.map((t) => t.url).sort().join('|');
    const key = `${snap.windowId}::${tabKey}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}
