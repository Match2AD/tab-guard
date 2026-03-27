import { getSnapshots, getClosedWindows, getStorageUsage } from '../storage.js';
import { formatRelativeTime, formatDateHeading, deduplicateSnapshots } from '../utils.js';
import { el, faviconLg, clearChildren } from '../dom.js';

const timeline = document.getElementById('timeline');
const searchInput = document.getElementById('search-input');
const storageInfo = document.getElementById('storage-info');
const clearBtn = document.getElementById('clear-history');

let allEntries = [];

function renderSnapshotCard(snapshot) {
  const toggleSpan = el('span', { className: 'snapshot-toggle', textContent: '\u25B8' });
  const titleSpan = el('span', { className: 'snapshot-title' }, [
    toggleSpan,
    ` Fenster \u2014 ${snapshot.tabs.length} Tabs`,
  ]);

  const restoreBtn = el('button', {
    className: 'btn-restore-sm',
    textContent: 'Wiederherstellen',
    onClick: (e) => {
      e.stopPropagation();
      chrome.windows.create({ url: snapshot.tabs.map((t) => t.url) });
    },
  });

  const meta = el('div', { className: 'snapshot-meta' }, [
    el('span', { className: 'snapshot-time', textContent: formatRelativeTime(snapshot.timestamp) }),
    restoreBtn,
  ]);

  const header = el('div', { className: 'snapshot-header' }, [titleSpan, meta]);

  const tabList = el('div', { className: 'snapshot-tabs' });

  for (const tab of snapshot.tabs) {
    const item = el('div', {
      className: 'snapshot-tab',
      onClick: () => chrome.tabs.create({ url: tab.url }),
    }, [
      faviconLg(tab.favIconUrl),
      el('span', { className: 'snapshot-tab-title', textContent: tab.title || tab.url }),
    ]);
    tabList.appendChild(item);
  }

  header.addEventListener('click', () => {
    const expanded = tabList.classList.toggle('expanded');
    toggleSpan.textContent = expanded ? '\u25BE' : '\u25B8';
  });

  return el('div', { className: 'snapshot-card' }, [header, tabList]);
}

function groupByDay(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const heading = formatDateHeading(entry.timestamp);
    if (!groups.has(heading)) groups.set(heading, []);
    groups.get(heading).push(entry);
  }
  return groups;
}

function renderTimeline(entries) {
  clearChildren(timeline);

  if (entries.length === 0) {
    timeline.appendChild(el('p', { className: 'empty-state', textContent: 'Keine History vorhanden.' }));
    return;
  }

  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const groups = groupByDay(sorted);

  for (const [heading, snapshots] of groups) {
    const group = el('div', { className: 'day-group' }, [
      el('h2', { className: 'day-heading', textContent: heading }),
    ]);
    for (const snap of snapshots) {
      group.appendChild(renderSnapshotCard(snap));
    }
    timeline.appendChild(group);
  }
}

function filterEntries(query) {
  if (!query.trim()) {
    renderTimeline(allEntries);
    return;
  }

  const lower = query.toLowerCase();
  const filtered = allEntries.filter((snap) =>
    snap.tabs.some(
      (tab) =>
        (tab.title || '').toLowerCase().includes(lower) ||
        (tab.url || '').toLowerCase().includes(lower)
    )
  );

  if (filtered.length === 0) {
    clearChildren(timeline);
    timeline.appendChild(
      el('p', { className: 'no-results', textContent: `Keine Ergebnisse f\u00FCr "${query}"` })
    );
    return;
  }

  renderTimeline(filtered);
}

async function loadHistory() {
  const [snapshots, closed] = await Promise.all([
    getSnapshots(),
    getClosedWindows(),
  ]);

  const combined = [...snapshots, ...closed];
  allEntries = deduplicateSnapshots(combined);
  renderTimeline(allEntries);
}

async function updateStorageInfo() {
  const bytes = await getStorageUsage();
  const kb = (bytes / 1024).toFixed(1);
  const mb = (bytes / (1024 * 1024)).toFixed(2);

  storageInfo.textContent = bytes > 1024 * 1024
    ? `Speicher: ${mb} MB von 10 MB`
    : `Speicher: ${kb} KB von 10 MB`;
}

// --- Event Listeners ---

searchInput.addEventListener('input', (e) => filterEntries(e.target.value));

clearBtn.addEventListener('click', async () => {
  const confirmed = confirm('M\u00F6chtest du die komplette History l\u00F6schen? Das kann nicht r\u00FCckg\u00E4ngig gemacht werden.');
  if (!confirmed) return;

  await chrome.storage.local.set({ tg_snapshots: [], tg_closed_windows: [] });
  allEntries = [];
  renderTimeline([]);
  updateStorageInfo();
});

// --- Init ---

loadHistory();
updateStorageInfo();
