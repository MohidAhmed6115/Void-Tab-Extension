// ============================================================
//  VoidTab — newtab.js
//  Handles: boards, groups, bookmarks, wallpaper, modals,
//           sidebar actions, multi-select, trash, search, theme
// ============================================================

// ---------- STATE ----------
let state = {
  boards: [
    {
      id: 'home',
      name: 'Home',
      groups: [
        {
          id: 'ai',
          name: 'AI',
          bookmarks: [
            { id: bkId(), title: 'Claude', url: 'https://claude.ai' },
            { id: bkId(), title: 'ChatGPT', url: 'https://chat.openai.com' },
            { id: bkId(), title: 'Gemini', url: 'https://gemini.google.com' }
          ]
        },
        {
          id: 'tools',
          name: 'Tools',
          bookmarks: [
            { id: bkId(), title: 'GitHub', url: 'https://github.com' },
            { id: bkId(), title: 'Tinkercad', url: 'https://tinkercad.com' }
          ]
        }
      ]
    },
    {
      id: 'extra',
      name: 'Extra',
      groups: []
    }
  ],
  currentBoardId: 'home',
  wallpaper: '',
  theme: 'auto',
  apiKey: '',
  trash: [],
  privacyBlur: false,
  editMode: false,
  groupPositions: {}, // { [boardId]: { [groupId]: { x, y } } }
  multiSelectMode: false,
  selectedBookmarks: [], // [{groupId, bookmarkId}]
  cardEffect: 'transparent',
};

let contextTarget = null; // { groupId, bookmarkId }
let dragState = null; // { type, groupId?, bookmarkId?, fromGroupId? }

const GROUP_STACK_GAP_PX = 15;
const GROUP_TOP_MARGIN_PX = 20;
const GROUP_LEFT_MARGIN_PX = 20;
const GROUP_SNAP_TOLERANCE_PX = 22;
const GROUP_CARD_WIDTH_PX = 240;
const GROUP_CARD_MIN_HEIGHT_PX = 190;

// ---------- UTILS ----------
function bkId() { return Math.random().toString(36).slice(2, 9); }
function groupId() { return 'g_' + Math.random().toString(36).slice(2, 7); }
function boardId() { return 'b_' + Math.random().toString(36).slice(2, 7); }

function getFavicon(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch { return ''; }
}

function currentBoard() {
  return state.boards.find(b => b.id === state.currentBoardId) || state.boards[0];
}

function getBoardPositions() {
  if (!state.groupPositions) state.groupPositions = {};
  if (!state.groupPositions[state.currentBoardId]) state.groupPositions[state.currentBoardId] = {};
  return state.groupPositions[state.currentBoardId];
}

function getSnappedGroupPosition(grid, draggingGroupId, proposedX, proposedY, draggedCard) {
  let snappedX = proposedX;
  let snappedY = proposedY;
  const cards = Array.from(grid.querySelectorAll('.group-card'));
  const draggedHeight = draggedCard ? draggedCard.offsetHeight : 0;

  for (const otherCard of cards) {
    const otherGroupId = otherCard.dataset.groupId;
    if (!otherGroupId || otherGroupId === draggingGroupId) continue;
    const otherX = parseInt(otherCard.style.left || '0', 10) || 0;
    const otherY = parseInt(otherCard.style.top || '0', 10) || 0;
    const otherHeight = otherCard.offsetHeight;

    // Snap same column (left edges align).
    if (Math.abs(proposedX - otherX) <= GROUP_SNAP_TOLERANCE_PX) {
      snappedX = otherX;
    }

    // Snap directly below another group with fixed vertical gap.
    const belowY = otherY + otherHeight + GROUP_STACK_GAP_PX;
    if (
      Math.abs(proposedX - otherX) <= GROUP_SNAP_TOLERANCE_PX &&
      Math.abs(proposedY - belowY) <= GROUP_SNAP_TOLERANCE_PX
    ) {
      snappedX = otherX;
      snappedY = belowY;
    }

    // Snap directly above another group with fixed vertical gap.
    const aboveY = otherY - draggedHeight - GROUP_STACK_GAP_PX;
    if (
      Math.abs(proposedX - otherX) <= GROUP_SNAP_TOLERANCE_PX &&
      Math.abs(proposedY - aboveY) <= GROUP_SNAP_TOLERANCE_PX
    ) {
      snappedX = otherX;
      snappedY = aboveY;
    }
  }

  return {
    x: Math.max(GROUP_LEFT_MARGIN_PX, snappedX),
    y: Math.max(GROUP_TOP_MARGIN_PX, snappedY),
  };
}

// ---------- PERSIST ----------
function save() {
  chrome.storage.sync.set({ voidtab_state: JSON.stringify(state) });
}

function load(cb) {
  chrome.storage.sync.get(['voidtab_state'], (result) => {
    if (result.voidtab_state) {
      try {
        const saved = JSON.parse(result.voidtab_state);
        // Merge so new keys (like cardEffect) keep their defaults
        state = Object.assign(state, saved);
      } catch(e) {}
    }
    cb();
  });
}

// ---------- THEME ----------
function applyTheme() {
  const t = state.theme;
  if (t === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
}

// ---------- WALLPAPER ----------
function applyWallpaper() {
  const bg = document.getElementById('wallpaper-bg');
  if (state.wallpaper === '__local__') {
    const local = localStorage.getItem('voidtab_wallpaper_local');
    if (local) bg.style.backgroundImage = `url('${local}')`;
    else bg.style.backgroundImage = '';
  } else if (state.wallpaper) {
    bg.style.backgroundImage = `url('${state.wallpaper}')`;
  } else {
    bg.style.backgroundImage = '';
  }
}

// ---------- CARD EFFECT ----------
function applyCardEffect() {
  const effect = state.cardEffect || 'transparent';
  document.documentElement.setAttribute('data-card-effect', effect);
  document.body.setAttribute('data-card-effect', effect);
}

// ---------- RENDER BOARDS ----------
function renderBoardTabs() {
  const list = document.getElementById('board-tabs-list');
  list.innerHTML = '';
  state.boards.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'board-tab' + (b.id === state.currentBoardId ? ' active' : '');
    btn.textContent = b.name;
    btn.addEventListener('click', () => { state.currentBoardId = b.id; save(); render(); });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (state.boards.length > 1) {
        if (confirm(`Delete board "${b.name}"?`)) {
          state.boards = state.boards.filter(x => x.id !== b.id);
          if (state.currentBoardId === b.id) state.currentBoardId = state.boards[0].id;
          save(); render();
        }
      }
    });
    list.appendChild(btn);
  });
}

// ---------- RENDER GROUPS ----------
function renderGroups() {
  const grid = document.getElementById('main-grid');
  grid.innerHTML = '';
  const board = currentBoard();
  if (!board) return;
  const boardPositions = getBoardPositions();
  const placedCards = [];

  // Estimate a default cascading layout for cards without saved position.
  const cardWidth = GROUP_CARD_WIDTH_PX;
  const gap = 14;
  const columns = Math.max(1, Math.floor((grid.clientWidth - 20) / (cardWidth + gap)));

  board.groups.forEach((group, index) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = group.id;
    if (state.editMode) card.classList.add('edit-enabled');
    card.draggable = false;

    // Header
    const header = document.createElement('div');
    header.className = 'group-header';
    const title = document.createElement('span');
    title.className = 'group-title';
    title.textContent = group.name;
    title.addEventListener('dblclick', () => {
      const newName = prompt('Rename group:', group.name);
      if (newName && newName.trim()) {
        group.name = newName.trim();
        save(); renderGroups();
      }
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'group-add-btn';
    addBtn.title = 'Add bookmark';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => promptAddBookmark(group));
    const delBtn = document.createElement('button');
    delBtn.className = 'group-delete-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete group';
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete group "${group.name}"?`)) {
        const board = currentBoard();
        board.groups = board.groups.filter(g => g.id !== group.id);
        save(); renderGroups();
      }
    });
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '::';
    dragHandle.title = 'Drag group';
    dragHandle.classList.toggle('hidden', !state.editMode);

    header.append(title, dragHandle, addBtn, delBtn);
    card.appendChild(header);

    // Bookmarks
    const bookmarkList = document.createElement('div');
    bookmarkList.className = 'bookmark-list';
    bookmarkList.dataset.groupId = group.id;

    group.bookmarks.forEach(bk => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      if (state.editMode) item.classList.add('edit-enabled');
      item.draggable = !!state.editMode;
      const isSelected = state.selectedBookmarks.some(s => s.bookmarkId === bk.id);
      if (isSelected) item.classList.add('selected');
      item.dataset.bookmarkId = bk.id;

      const favicon = document.createElement('img');
      favicon.className = 'bookmark-favicon';
      favicon.src = getFavicon(bk.url);
      favicon.onerror = () => {
        favicon.replaceWith(makeFaviconPlaceholder(bk.title));
      };

      const titleEl = document.createElement('span');
      titleEl.className = 'bookmark-title';
      titleEl.textContent = bk.title;

      item.append(favicon, titleEl);

      item.addEventListener('click', (e) => {
        if (state.editMode) return;
        if (state.multiSelectMode) {
          toggleSelect(group.id, bk.id, item);
        } else {
          window.open(bk.url, '_blank');
        }
      });

      item.addEventListener('contextmenu', (e) => {
        if (state.editMode) return;
        e.preventDefault();
        contextTarget = { group, bookmark: bk };
        showContextMenu(e.clientX, e.clientY);
      });

      bookmarkList.appendChild(item);
    });
    card.appendChild(bookmarkList);

    const existing = boardPositions[group.id];
    if (!existing) {
      const defaultX = GROUP_LEFT_MARGIN_PX + (index % columns) * (cardWidth + gap);
      const defaultY = GROUP_TOP_MARGIN_PX + Math.floor(index / columns) * 220;
      boardPositions[group.id] = { x: defaultX, y: defaultY };
    }
    const pos = boardPositions[group.id];
    card.style.position = 'absolute';
    card.style.left = `${Math.max(GROUP_LEFT_MARGIN_PX, pos.x || 0)}px`;
    card.style.top = `${Math.max(GROUP_TOP_MARGIN_PX, pos.y || 0)}px`;
    card.style.width = `${GROUP_CARD_WIDTH_PX}px`;
    card.style.minHeight = `${GROUP_CARD_MIN_HEIGHT_PX}px`;
    placedCards.push(card);

    grid.appendChild(card);
  });

  // Add group card
  const addCard = document.createElement('div');
  addCard.className = 'add-group-card';
  addCard.innerHTML = `<span>+</span><span>New Group</span>`;
  addCard.addEventListener('click', () => openModal('add-group-modal'));
  addCard.classList.toggle('hidden', state.editMode);
  addCard.style.position = 'absolute';
  addCard.style.left = `${GROUP_LEFT_MARGIN_PX}px`;
  grid.appendChild(addCard);

  requestAnimationFrame(() => {
    let maxBottom = 0;
    placedCards.forEach((card) => {
      const top = parseInt(card.style.top || '0', 10) || 0;
      const bottom = top + card.offsetHeight;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    if (!state.editMode) {
      addCard.style.top = `${Math.max(GROUP_TOP_MARGIN_PX, maxBottom + GROUP_STACK_GAP_PX)}px`;
    } else {
      addCard.style.top = `${GROUP_TOP_MARGIN_PX}px`;
    }
    grid.style.minHeight = `${Math.max(520, maxBottom + 120)}px`;
  });

  initDragAndDrop();
}

function makeFaviconPlaceholder(title) {
  const el = document.createElement('div');
  el.className = 'bookmark-favicon-placeholder';
  el.textContent = title ? title[0].toUpperCase() : '?';
  return el;
}

// ---------- FULL RENDER ----------
function render() {
  applyTheme();
  applyWallpaper();
  renderBoardTabs();
  renderGroups();
  updatePrivacyBtn();
  updateEditModeBtn();
  updateMultiselectBtn();
}

function moveGroup(groupId, newIndex) {
  const board = currentBoard();
  const oldIndex = board.groups.findIndex((g) => g.id === groupId);
  if (oldIndex < 0 || oldIndex === newIndex) return;
  const [moved] = board.groups.splice(oldIndex, 1);
  board.groups.splice(newIndex, 0, moved);
}

function moveBookmark(bookmarkId, fromGroupId, toGroupId, toIndex) {
  const board = currentBoard();
  const fromGroup = board.groups.find((g) => g.id === fromGroupId);
  const toGroup = board.groups.find((g) => g.id === toGroupId);
  if (!fromGroup || !toGroup) return;
  const oldIndex = fromGroup.bookmarks.findIndex((b) => b.id === bookmarkId);
  if (oldIndex < 0) return;
  const [moved] = fromGroup.bookmarks.splice(oldIndex, 1);
  toGroup.bookmarks.splice(toIndex, 0, moved);
}

function getInsertIndexFromPointer(evt, targetEl, baseIndex) {
  const rect = targetEl.getBoundingClientRect();
  const isAfter = evt.clientY > rect.top + rect.height / 2;
  return baseIndex + (isAfter ? 1 : 0);
}

function clearGroupDropIndicators() {
  document.querySelectorAll('.group-card.drop-before, .group-card.drop-after').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after');
  });
}

function getGroupDropPlacement(evt, draggedGroupId) {
  if (!draggedGroupId) return null;

  const elementUnderPointer = document.elementFromPoint(evt.clientX, evt.clientY);
  const targetCard = elementUnderPointer && elementUnderPointer.closest
    ? elementUnderPointer.closest('.group-card')
    : null;
  if (!targetCard) return null;

  const targetGroupId = targetCard.dataset.groupId;
  if (!targetGroupId || targetGroupId === draggedGroupId) return null;

  const rect = targetCard.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = Math.abs(evt.clientX - centerX);
  const dy = Math.abs(evt.clientY - centerY);
  const before = dx >= dy ? evt.clientX < centerX : evt.clientY < centerY;

  return { targetCard, targetGroupId, before };
}

function applyGroupDropHint(placement) {
  clearGroupDropIndicators();
  if (!placement || !placement.targetCard) return;
  placement.targetCard.classList.add(placement.before ? 'drop-before' : 'drop-after');
}

function persistGroupOrderFromDOM() {
  const board = currentBoard();
  const domIds = Array.from(document.querySelectorAll('#main-grid .group-card'))
    .map((card) => card.dataset.groupId)
    .filter(Boolean);
  if (!domIds.length) return;
  const byId = new Map(board.groups.map((group) => [group.id, group]));
  board.groups = domIds.map((id) => byId.get(id)).filter(Boolean);
}

function clearDropTargets() {
  document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
}

function initDragAndDrop() {
  if (!state.editMode) return;

  const grid = document.getElementById('main-grid');
  const cards = document.querySelectorAll('.group-card');
  const bookmarkLists = document.querySelectorAll('.bookmark-list');
  const bookmarkItems = document.querySelectorAll('.bookmark-item');

  cards.forEach((card) => {
    const groupId = card.dataset.groupId;
    const handle = card.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (evt) => {
      evt.preventDefault();
      const boardPositions = getBoardPositions();
      const startPos = boardPositions[groupId] || { x: 0, y: 0 };
      const startX = evt.clientX;
      const startY = evt.clientY;

      card.classList.add('drag-chosen', 'drag-active');

      const onMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        const nextX = startPos.x + dx;
        const nextY = startPos.y + dy;
        const snapped = getSnappedGroupPosition(grid, groupId, nextX, nextY, card);
        boardPositions[groupId] = { x: snapped.x, y: snapped.y };
        card.style.left = `${snapped.x}px`;
        card.style.top = `${snapped.y}px`;
      };

      const onUp = () => {
        card.classList.remove('drag-chosen', 'drag-active');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        save();
        requestAnimationFrame(() => {
          let maxBottom = 0;
          document.querySelectorAll('.group-card').forEach((c) => {
            const top = parseInt(c.style.top || '0', 10) || 0;
            const bottom = top + c.offsetHeight;
            if (bottom > maxBottom) maxBottom = bottom;
          });
          grid.style.minHeight = `${Math.max(520, maxBottom + 40)}px`;
        });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  bookmarkItems.forEach((item) => {
    item.addEventListener('dragstart', (evt) => {
      const list = item.closest('.bookmark-list');
      if (!list) return;
      dragState = { type: 'bookmark', bookmarkId: item.dataset.bookmarkId, fromGroupId: list.dataset.groupId };
      item.classList.add('drag-chosen', 'drag-active');
      evt.dataTransfer.effectAllowed = 'move';
      evt.dataTransfer.setData('application/x-voidtab-type', 'bookmark');
      evt.dataTransfer.setData('application/x-voidtab-bookmark-id', item.dataset.bookmarkId);
      evt.dataTransfer.setData('application/x-voidtab-from-group-id', list.dataset.groupId);
      evt.dataTransfer.setData('text/plain', `bookmark:${item.dataset.bookmarkId}`);
    });

    item.addEventListener('dragend', () => {
      dragState = null;
      item.classList.remove('drag-chosen', 'drag-active');
      clearDropTargets();
      clearGroupDropIndicators();
    });

    item.addEventListener('dragover', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'move';
      item.classList.add('drop-target');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drop-target');
    });

    item.addEventListener('drop', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();

      const bookmarkId = dragState.bookmarkId;
      const fromGroupId = dragState.fromGroupId;
      const toList = item.closest('.bookmark-list');
      if (!toList) return;
      const toGroupId = toList.dataset.groupId;
      if (!bookmarkId || !fromGroupId || !toGroupId) return;

      const board = currentBoard();
      const toGroup = board.groups.find((g) => g.id === toGroupId);
      if (!toGroup) return;

      const baseIndex = toGroup.bookmarks.findIndex((b) => b.id === item.dataset.bookmarkId);
      if (baseIndex < 0) return;
      const oldIndex = (board.groups.find((g) => g.id === fromGroupId) || { bookmarks: [] })
        .bookmarks.findIndex((b) => b.id === bookmarkId);
      let newIndex = getInsertIndexFromPointer(evt, item, baseIndex);
      if (fromGroupId === toGroupId && oldIndex > -1 && oldIndex < newIndex) newIndex -= 1;

      moveBookmark(bookmarkId, fromGroupId, toGroupId, newIndex);
      save();
      renderGroups();
    });
  });

  bookmarkLists.forEach((list) => {
    list.addEventListener('dragover', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'move';
      list.classList.add('drop-target');
    });

    list.addEventListener('dragleave', () => {
      list.classList.remove('drop-target');
    });

    list.addEventListener('drop', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();

      const bookmarkId = dragState.bookmarkId;
      const fromGroupId = dragState.fromGroupId;
      const toGroupId = list.dataset.groupId;
      if (!bookmarkId || !fromGroupId || !toGroupId) return;

      const board = currentBoard();
      const toGroup = board.groups.find((g) => g.id === toGroupId);
      if (!toGroup) return;
      moveBookmark(bookmarkId, fromGroupId, toGroupId, toGroup.bookmarks.length);
      save();
      renderGroups();
    });
  });

  // Group drag in edit mode uses pointer-based free placement above.
}

// ---------- ADD BOOKMARK ----------
function promptAddBookmark(group) {
  const url = prompt('Enter URL:');
  if (!url || !url.trim()) return;
  const title = prompt('Title:', new URL(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim()).hostname) || url;
  group.bookmarks.push({ id: bkId(), title, url: url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim() });
  save(); renderGroups();
}

// ---------- CONTEXT MENU ----------
function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 160) + 'px';
  menu.classList.remove('hidden');
}
function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
  contextTarget = null;
}
document.addEventListener('click', () => hideContextMenu());

document.getElementById('ctx-open').addEventListener('click', () => {
  if (contextTarget) window.open(contextTarget.bookmark.url, '_blank');
});
document.getElementById('ctx-open-incognito').addEventListener('click', () => {
  if (contextTarget) {
    chrome.runtime.sendMessage({ type: 'open_incognito', url: contextTarget.bookmark.url });
  }
});
document.getElementById('ctx-edit').addEventListener('click', () => {
  if (!contextTarget) return;
  const { group, bookmark } = contextTarget;
  const newTitle = prompt('Edit title:', bookmark.title);
  if (newTitle) bookmark.title = newTitle.trim();
  const newUrl = prompt('Edit URL:', bookmark.url);
  if (newUrl) bookmark.url = newUrl.trim();
  save(); renderGroups();
});
document.getElementById('ctx-delete').addEventListener('click', () => {
  if (!contextTarget) return;
  const { group, bookmark } = contextTarget;
  group.bookmarks = group.bookmarks.filter(b => b.id !== bookmark.id);
  state.trash.push({ ...bookmark, deletedAt: Date.now(), fromGroup: group.name });
  save(); renderGroups();
});

// ---------- MULTI-SELECT ----------
function toggleSelect(groupId, bookmarkId, el) {
  const idx = state.selectedBookmarks.findIndex(s => s.bookmarkId === bookmarkId);
  if (idx > -1) {
    state.selectedBookmarks.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    state.selectedBookmarks.push({ groupId, bookmarkId });
    el.classList.add('selected');
  }
}

function updateMultiselectBtn() {
  const btn = document.getElementById('btn-multiselect');
  btn.classList.toggle('active', state.multiSelectMode);
}

document.getElementById('btn-multiselect').addEventListener('click', () => {
  state.multiSelectMode = !state.multiSelectMode;
  if (!state.multiSelectMode) {
    state.selectedBookmarks = [];
    renderGroups();
  }
  updateMultiselectBtn();
});

// ---------- PRIVACY BLUR ----------
function updatePrivacyBtn() {
  document.getElementById('btn-privacy').classList.toggle('active', state.privacyBlur);
  document.body.classList.toggle('privacy-blur', state.privacyBlur);
}

document.getElementById('btn-privacy').addEventListener('click', () => {
  state.privacyBlur = !state.privacyBlur;
  save(); render();
});

function updateEditModeBtn() {
  document.getElementById('btn-edit-mode').classList.toggle('active', state.editMode);
  document.body.classList.toggle('edit-mode', state.editMode);
}

document.getElementById('btn-edit-mode').addEventListener('click', () => {
  state.editMode = !state.editMode;
  if (state.editMode) {
    state.multiSelectMode = false;
    state.selectedBookmarks = [];
  }
  save();
  render();
});

// ---------- MODALS ----------
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('.modal');
    if (modal) modal.classList.add('hidden');
  });
});
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
});

// ---------- SEARCH ----------
document.getElementById('btn-search').addEventListener('click', () => {
  openModal('search-modal');
  setTimeout(() => document.getElementById('search-input').focus(), 100);
});

document.getElementById('search-input').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const results = document.getElementById('search-results');
  results.innerHTML = '';
  if (!q) return;
  state.boards.forEach(board => {
    board.groups.forEach(group => {
      group.bookmarks.forEach(bk => {
        if (bk.title.toLowerCase().includes(q) || bk.url.toLowerCase().includes(q)) {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          const img = document.createElement('img');
          img.className = 'bookmark-favicon';
          img.src = getFavicon(bk.url);
          const span = document.createElement('span');
          span.textContent = `${bk.title} — ${group.name} (${board.name})`;
          item.append(img, span);
          item.addEventListener('click', () => { window.open(bk.url, '_blank'); closeModal('search-modal'); });
          results.appendChild(item);
        }
      });
    });
  });
  if (!results.children.length) results.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:10px">No results found.</p>';
});

// ---------- BULK IMPORT ----------
document.getElementById('btn-bulk-import').addEventListener('click', () => openModal('bulk-modal'));

document.getElementById('bulk-analyze-btn').addEventListener('click', async () => {
  const raw = document.getElementById('bulk-textarea').value.trim();
  const urls = raw.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
  if (!urls.length) return;
  const resultsDiv = document.getElementById('bulk-results');
  resultsDiv.innerHTML = '<p style="color:var(--text-muted);font-size:12px">Analyzing with AI...</p>';

  const suggested = await window.aiSuggestGroups(urls, state.boards.flatMap(b => b.groups.map(g => g.name)));
  resultsDiv.innerHTML = '';
  suggested.forEach(item => {
    const row = document.createElement('div');
    row.className = 'bulk-row';
    const urlEl = document.createElement('span'); urlEl.className = 'url'; urlEl.textContent = item.url;
    const arrEl = document.createElement('span'); arrEl.textContent = '→';
    const sugEl = document.createElement('span'); sugEl.className = 'suggested'; sugEl.textContent = item.group;
    const addBtn = document.createElement('button');
    addBtn.style.cssText = 'background:var(--accent);color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer;';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      const board = currentBoard();
      let group = board.groups.find(g => g.name.toLowerCase() === item.group.toLowerCase());
      if (!group) {
        group = { id: groupId(), name: item.group, bookmarks: [] };
        board.groups.push(group);
      }
      try {
        const u = new URL(item.url);
        group.bookmarks.push({ id: bkId(), title: u.hostname, url: item.url });
      } catch {}
      save(); renderGroups();
      addBtn.textContent = '✓'; addBtn.disabled = true;
    });
    row.append(urlEl, arrEl, sugEl, addBtn);
    resultsDiv.appendChild(row);
  });
});

// ---------- INCOGNITO ----------
document.getElementById('btn-incognito').addEventListener('click', () => {
  const url = prompt('Open URL in incognito:');
  if (url) chrome.runtime.sendMessage({ type: 'open_incognito', url });
});

// ---------- TRASH ----------
document.getElementById('btn-trash').addEventListener('click', () => {
  renderTrash();
  openModal('trash-modal');
});

function renderTrash() {
  const list = document.getElementById('trash-list');
  list.innerHTML = '';
  if (!state.trash.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px">Trash is empty.</p>';
    return;
  }
  state.trash.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'trash-item';
    const info = document.createElement('span'); info.textContent = `${item.title} (${item.fromGroup})`;
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'trash-restore-btn'; restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => {
      const board = currentBoard();
      let group = board.groups.find(g => g.name === item.fromGroup);
      if (!group) { group = { id: groupId(), name: item.fromGroup, bookmarks: [] }; board.groups.push(group); }
      group.bookmarks.push({ id: bkId(), title: item.title, url: item.url });
      state.trash.splice(idx, 1);
      save(); renderGroups(); renderTrash();
    });
    row.append(info, restoreBtn);
    list.appendChild(row);
  });
}

document.getElementById('empty-trash-btn').addEventListener('click', () => {
  if (confirm('Permanently delete all trashed items?')) {
    state.trash = [];
    save(); renderTrash();
  }
});

// ---------- SETTINGS ----------
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('api-key-input').value = state.apiKey || '';
  document.getElementById('theme-select').value = state.theme || 'auto';
  // Sync effect buttons
  const currentEffect = state.cardEffect || 'transparent';
  document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.effect === currentEffect);
  });
  openModal('settings-modal');
});

document.getElementById('save-settings-btn').addEventListener('click', () => {
  state.apiKey = document.getElementById('api-key-input').value.trim();
  state.theme = document.getElementById('theme-select').value;
  save(); closeModal('settings-modal'); applyTheme(); applyCardEffect();
});

// ---------- ADD BOARD ----------
document.getElementById('add-board-btn').addEventListener('click', () => {
  const name = prompt('Board name:');
  if (name && name.trim()) {
    const id = boardId();
    state.boards.push({ id, name: name.trim(), groups: [] });
    state.currentBoardId = id;
    save(); render();
  }
});

// ---------- ADD GROUP ----------
document.getElementById('confirm-add-group-btn').addEventListener('click', () => {
  const name = document.getElementById('new-group-name').value.trim();
  if (!name) return;
  currentBoard().groups.push({ id: groupId(), name, bookmarks: [] });
  document.getElementById('new-group-name').value = '';
  save(); renderGroups(); closeModal('add-group-modal');
});

// ---------- WALLPAPER ----------
document.getElementById('wallpaper-btn').addEventListener('click', () => {
  // Reset file input state
  document.getElementById('wallpaper-file-input').value = '';
  document.getElementById('upload-filename').textContent =
    state.wallpaper === '__local__' ? '(local image active)' : 'No file chosen';
  document.getElementById('custom-wallpaper-input').value =
    (state.wallpaper && state.wallpaper !== '__local__') ? state.wallpaper : '';
  openModal('wallpaper-modal');
});

document.getElementById('apply-wallpaper-btn').addEventListener('click', () => {
  const val = document.getElementById('custom-wallpaper-input').value.trim();
  if (val) state.wallpaper = val;
  save(); applyWallpaper(); closeModal('wallpaper-modal');
});

// Upload image from device
document.getElementById('wallpaper-upload-btn').addEventListener('click', () => {
  document.getElementById('wallpaper-file-input').click();
});

document.getElementById('wallpaper-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    // Store in localStorage (base64) since chrome.storage.sync has size limits
    try {
      localStorage.setItem('voidtab_wallpaper_local', dataUrl);
    } catch(err) {
      alert('Image too large. Please use a smaller image or a URL instead.');
      return;
    }
    state.wallpaper = '__local__';
    document.getElementById('custom-wallpaper-input').value = '';
    document.getElementById('upload-filename').textContent = file.name;
  };
  reader.readAsDataURL(file);
});

// ---------- AI PANEL ----------
document.getElementById('ai-fab').addEventListener('click', () => {
  document.getElementById('ai-panel').classList.toggle('hidden');
});
document.getElementById('ai-panel-close').addEventListener('click', () => {
  document.getElementById('ai-panel').classList.add('hidden');
});

const aiInput = document.getElementById('ai-input');
const aiSend = document.getElementById('ai-send');

function sendAIMessage() {
  const text = aiInput.value.trim();
  if (!text) return;
  appendAIMsg('user', text);
  aiInput.value = '';
  window.aiChat(text);
}
aiSend.addEventListener('click', sendAIMessage);
aiInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAIMessage(); });

function appendAIMsg(role, text) {
  const msgs = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

window.appendAIMsg = appendAIMsg;

// ---------- CARD EFFECT BUTTONS ----------
document.querySelectorAll('.effect-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.cardEffect = btn.dataset.effect;
    document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyCardEffect();
    save();
  });
});

// ---------- KEYBOARD SHORTCUTS ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    hideContextMenu();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openModal('search-modal');
    setTimeout(() => document.getElementById('search-input').focus(), 100);
  }
});

// ---------- SYSTEM THEME LISTENER ----------
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'auto') applyTheme();
});

// ---------- INIT ----------
load(() => { render(); applyCardEffect(); });
