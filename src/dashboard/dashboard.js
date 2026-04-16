import { getSnapshots, getClosedWindows, getStorageUsage, clearAllHistory } from '../storage.js';
import { formatRelativeTime, formatDateHeading, deduplicateSnapshots } from '../utils.js';
import { el, faviconLg, clearChildren } from '../dom.js';
import { restoreWindow, restoreAllWindows, GROUP_COLORS } from '../restore.js';

const timeline = document.getElementById('timeline');
const searchInput = document.getElementById('search-input');
const storageInfo = document.getElementById('storage-info');
const clearBtn = document.getElementById('clear-history');
const restoreAllBtn = document.getElementById('restore-all');
const settingsLink = document.getElementById('settings-link');

let allEntries = [];
let closedEntries = [];
let activeFilter = 'all';

// --- Settings Link ---

settingsLink.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/settings/settings.html') });
});

// --- Stats ---

function updateStats(entries) {
  const windows = entries.length;
  const tabs = entries.reduce((sum, s) => sum + s.tabs.length, 0);
  const groups = entries.reduce((sum, s) => sum + (s.groups?.length || 0), 0);

  document.getElementById('stat-windows').textContent = String(windows).padStart(2, '0');
  document.getElementById('stat-tabs').textContent = tabs;
  document.getElementById('stat-groups').textContent = groups;
}

// --- Group Rendering ---

function renderGroupBadges(groups) {
  const container = el('div', { className: 'group-badges' });
  for (const group of groups) {
    const color = GROUP_COLORS[group.color] || '#5f6368';
    const badge = el('span', {
      className: 'group-badge',
      textContent: group.title || 'Gruppe',
    });
    badge.style.borderColor = color;
    badge.style.color = color;
    container.appendChild(badge);
  }
  return container;
}

function renderGroupedTabs(tabs, groups) {
  const container = el('div', { className: 'grouped-tabs' });
  const groupMap = new Map();

  for (const g of (groups || [])) {
    groupMap.set(g.id, g);
  }

  const ungrouped = tabs.filter((t) => t.groupId == null);
  const groupedByIdMap = new Map();

  for (const tab of tabs) {
    if (tab.groupId != null) {
      if (!groupedByIdMap.has(tab.groupId)) groupedByIdMap.set(tab.groupId, []);
      groupedByIdMap.get(tab.groupId).push(tab);
    }
  }

  for (const tab of ungrouped) {
    container.appendChild(renderTabItem(tab));
  }

  for (const [groupId, groupTabs] of groupedByIdMap.entries()) {
    const groupInfo = groupMap.get(groupId);
    const color = GROUP_COLORS[groupInfo?.color] || '#5f6368';
    const title = groupInfo?.title || 'Gruppe';

    const groupHeader = el('div', { className: 'group-header' }, [
      el('span', { className: 'group-dot' }),
      el('span', { className: 'group-name', textContent: `${title} (${groupTabs.length})` }),
    ]);
    groupHeader.querySelector('.group-dot').style.background = color;
    groupHeader.querySelector('.group-name').style.color = color;

    const groupSection = el('div', { className: 'group-section' });
    groupSection.style.borderLeftColor = color;

    groupSection.appendChild(groupHeader);
    for (const tab of groupTabs) {
      groupSection.appendChild(renderTabItem(tab));
    }

    container.appendChild(groupSection);
  }

  return container;
}

function renderTabItem(tab) {
  return el('div', {
    className: 'snapshot-tab',
    onClick: () => chrome.tabs.create({ url: tab.url }),
  }, [
    faviconLg(tab.favIconUrl),
    el('span', { className: 'snapshot-tab-title', textContent: tab.title || tab.url }),
  ]);
}

// --- Snapshot Cards ---

function renderSnapshotCard(snapshot) {
  const toggleSpan = el('span', { className: 'snapshot-toggle', textContent: '\u25B8' });
  const hasGroups = snapshot.groups && snapshot.groups.length > 0;
  const groupCount = hasGroups ? snapshot.groups.length : 0;

  const titleText = groupCount > 0
    ? ` Fenster \u2014 ${snapshot.tabs.length} Tabs, ${groupCount} Gruppe${groupCount > 1 ? 'n' : ''}`
    : ` Fenster \u2014 ${snapshot.tabs.length} Tabs`;

  const titleSpan = el('span', { className: 'snapshot-title' }, [toggleSpan, titleText]);

  // Icon button for restore
  const restoreIcon = el('span', { className: 'material-symbols-outlined', textContent: 'restore' });
  const restoreBtn = el('button', {
    className: 'btn-restore-sm',
    onClick: (e) => {
      e.stopPropagation();
      restoreWindow(snapshot);
    },
  }, [restoreIcon]);

  const metaChildren = [
    el('span', { className: 'snapshot-time', textContent: formatRelativeTime(snapshot.timestamp) }),
    restoreBtn,
  ];

  const meta = el('div', { className: 'snapshot-meta' }, metaChildren);
  const header = el('div', { className: 'snapshot-header' }, [titleSpan, meta]);

  let badgeRow = null;
  if (hasGroups) {
    badgeRow = el('div', { className: 'snapshot-badge-row' }, [renderGroupBadges(snapshot.groups)]);
  }

  const tabList = el('div', { className: 'snapshot-tabs' });
  tabList.appendChild(renderGroupedTabs(snapshot.tabs, snapshot.groups || []));

  header.addEventListener('click', () => {
    const expanded = tabList.classList.toggle('expanded');
    toggleSpan.textContent = expanded ? '\u25BE' : '\u25B8';
  });

  const cardChildren = [header];
  if (badgeRow) cardChildren.push(badgeRow);
  cardChildren.push(tabList);

  return el('div', { className: 'snapshot-card' }, cardChildren);
}

// --- Timeline ---

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
  updateStats(entries);

  if (entries.length === 0) {
    timeline.appendChild(el('p', { className: 'empty-state', textContent: 'Keine History vorhanden.' }));
    return;
  }

  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const groups = groupByDay(sorted);

  for (const [heading, snapshots] of groups) {
    // Day header with restore button
    const dayHeadingLeft = el('div', { className: 'day-heading-left' }, [
      el('span', { className: 'day-heading', textContent: heading }),
      el('div', { className: 'day-line' }),
    ]);

    const dayRestoreBtn = el('button', {
      className: 'btn-restore-day',
      textContent: `${heading} wiederherstellen (${snapshots.length})`,
      onClick: () => restoreAllWindows(snapshots),
    });

    const dayHeader = el('div', { className: 'day-header' }, [dayHeadingLeft, dayRestoreBtn]);

    const group = el('div', { className: 'day-group' }, [dayHeader]);
    for (const snap of snapshots) {
      group.appendChild(renderSnapshotCard(snap));
    }
    timeline.appendChild(group);
  }
}

// --- Filtering ---

function applyFilter(entries, filter) {
  if (filter === 'grouped') {
    return entries.filter((s) => s.groups && s.groups.length > 0);
  }
  if (filter === 'closed') {
    return entries.filter((s) => closedEntries.some((c) => c.id === s.id));
  }
  return entries;
}

function filterEntries(query) {
  let filtered = allEntries;

  if (activeFilter !== 'all') {
    filtered = applyFilter(filtered, activeFilter);
  }

  if (query.trim()) {
    const lower = query.toLowerCase();
    filtered = filtered.filter((snap) =>
      snap.tabs.some(
        (tab) =>
          (tab.title || '').toLowerCase().includes(lower) ||
          (tab.url || '').toLowerCase().includes(lower)
      ) ||
      (snap.groups || []).some(
        (g) => (g.title || '').toLowerCase().includes(lower)
      )
    );
  }

  if (filtered.length === 0 && (query.trim() || activeFilter !== 'all')) {
    clearChildren(timeline);
    updateStats([]);
    timeline.appendChild(
      el('p', { className: 'no-results', textContent: query.trim() ? `Keine Ergebnisse f\u00FCr \u201E${query}\u201C` : 'Keine Eintr\u00E4ge f\u00FCr diesen Filter.' })
    );
    return;
  }

  renderTimeline(filtered);
}

// --- Filter Bar ---

const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    filterEntries(searchInput.value);
  });
});

// --- Load Data ---

async function loadHistory() {
  const [snapshots, closed] = await Promise.all([
    getSnapshots(),
    getClosedWindows(),
  ]);

  closedEntries = closed;
  const combined = [...snapshots, ...closed];
  allEntries = deduplicateSnapshots(combined);
  renderTimeline(allEntries);

  if (closed.length > 0) {
    const totalTabs = closed.reduce((sum, s) => sum + s.tabs.length, 0);
    restoreAllBtn.textContent = `Session wiederherstellen (${totalTabs} Tabs)`;
    restoreAllBtn.classList.remove('hidden');
  }
}

async function updateStorageInfo() {
  const bytes = await getStorageUsage();
  const kb = (bytes / 1024).toFixed(1);
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  const maxBytes = 10 * 1024 * 1024;
  const percent = Math.min((bytes / maxBytes) * 100, 100).toFixed(1);

  const display = bytes > 1024 * 1024 ? `${mb} MB` : `${kb} KB`;
  storageInfo.textContent = `Speicher: ${display} / 10 MB (${percent}%)`;
  document.getElementById('stat-storage').textContent = display;

  const fill = document.getElementById('storage-fill');
  if (fill) fill.style.width = `${percent}%`;
}

// --- Event Listeners ---

searchInput.addEventListener('input', (e) => filterEntries(e.target.value));

restoreAllBtn.addEventListener('click', () => {
  restoreAllWindows(closedEntries);
});

clearBtn.addEventListener('click', async () => {
  const confirmed = confirm('Komplette History l\u00F6schen? Das kann nicht r\u00FCckg\u00E4ngig gemacht werden.');
  if (!confirmed) return;

  await clearAllHistory();
  allEntries = [];
  closedEntries = [];
  renderTimeline([]);
  updateStorageInfo();
  restoreAllBtn.classList.add('hidden');
});

// --- Init ---

loadHistory();
updateStorageInfo();
