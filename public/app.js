const API = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || r.statusText);
    }
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || r.statusText);
    }
    return r.json();
  },
};

let currentQuery = '';
let currentPageToken = null;
let clauseId = 0;
let currentResultSizeEstimate = null;
let sortColumn = null;
let sortDir = 'asc';

const QUERY_OPERATORS = [
  { key: 'contains', label: 'contains', type: 'text', placeholder: 'word or phrase (searches entire message)', bare: true },
  { key: 'older_than', label: 'older_than:', type: 'duration' },
  { key: 'newer_than', label: 'newer_than:', type: 'duration' },
  { key: 'after', label: 'after:', type: 'text', placeholder: 'YYYY/MM/DD' },
  { key: 'before', label: 'before:', type: 'text', placeholder: 'YYYY/MM/DD' },
  { key: 'from', label: 'from:', type: 'text', placeholder: 'email or domain' },
  { key: 'to', label: 'to:', type: 'text', placeholder: 'email or domain' },
  { key: 'subject', label: 'subject:', type: 'text', placeholder: 'keyword or phrase' },
  { key: 'label', label: 'label:', type: 'text', placeholder: 'label name' },
  { key: 'has', label: 'has:', type: 'select', options: [
    { value: 'attachment', label: 'attachment' },
    { value: 'nouserlabels', label: 'nouserlabels' },
    { value: 'yellow-star', label: 'yellow-star' },
    { value: 'blue-star', label: 'blue-star' },
    { value: 'red-star', label: 'red-star' },
    { value: 'green-star', label: 'green-star' },
    { value: 'orange-star', label: 'orange-star' },
    { value: 'purple-star', label: 'purple-star' },
  ]},
  { key: 'in', label: 'in:', type: 'select', options: [
    { value: 'inbox', label: 'inbox' },
    { value: 'sent', label: 'sent' },
    { value: 'trash', label: 'trash' },
    { value: 'spam', label: 'spam' },
  ]},
  { key: 'is', label: 'is:', type: 'select', options: [
    { value: 'read', label: 'read' },
    { value: 'unread', label: 'unread' },
  ]},
  { key: 'category', label: 'category:', type: 'select', options: [
    { value: 'primary', label: 'primary' },
    { value: 'social', label: 'social' },
    { value: 'promotions', label: 'promotions' },
    { value: 'updates', label: 'updates' },
    { value: 'forums', label: 'forums' },
  ]},
  { key: 'size', label: 'size', type: 'size' },
];

function show(el) {
  el?.classList?.remove('hidden');
}

function hide(el) {
  el?.classList?.add('hidden');
}

/* Modal dialogs - replace alert/prompt/confirm */
function showModal(el) {
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
}

function hideModal(el) {
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
}

function modalAlert(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = `
      <h3 class="modal-title" id="modal-title">${escapeHtml(message)}</h3>
      <div class="modal-actions">
        <button type="button" class="btn btn-primary modal-ok">OK</button>
      </div>
    `;
    const ok = content.querySelector('.modal-ok');
    const handler = () => {
      ok.removeEventListener('click', handler);
      overlay.removeEventListener('click', overlayHandler);
      document.removeEventListener('keydown', keyHandler);
      hideModal(overlay);
      resolve();
    };
    const overlayHandler = (e) => {
      if (e.target === overlay) handler();
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') handler();
    };
    ok.addEventListener('click', handler);
    overlay.addEventListener('click', overlayHandler);
    document.addEventListener('keydown', keyHandler);
    showModal(overlay);
    ok.focus();
  });
}

function modalPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = `
      <h3 class="modal-title" id="modal-title">${escapeHtml(message)}</h3>
      <input type="text" class="modal-input" id="modal-input" value="${escapeHtml(defaultValue)}" />
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
        <button type="button" class="btn btn-primary modal-ok">OK</button>
      </div>
    `;
    const input = content.querySelector('#modal-input');
    const ok = content.querySelector('.modal-ok');
    const cancel = content.querySelector('.modal-cancel');
    const close = (value) => {
      ok.removeEventListener('click', okHandler);
      cancel.removeEventListener('click', cancelHandler);
      overlay.removeEventListener('click', overlayHandler);
      document.removeEventListener('keydown', keyHandler);
      hideModal(overlay);
      resolve(value);
    };
    const okHandler = () => close(input.value);
    const cancelHandler = () => close(null);
    const overlayHandler = (e) => {
      if (e.target === overlay) cancelHandler();
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') cancelHandler();
      if (e.key === 'Enter') okHandler();
    };
    ok.addEventListener('click', okHandler);
    cancel.addEventListener('click', cancelHandler);
    overlay.addEventListener('click', overlayHandler);
    document.addEventListener('keydown', keyHandler);
    showModal(overlay);
    input.focus();
    input.select();
  });
}

function modalConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = `
      <h3 class="modal-title" id="modal-title">${escapeHtml(message)}</h3>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
        <button type="button" class="btn btn-primary modal-ok">OK</button>
      </div>
    `;
    const ok = content.querySelector('.modal-ok');
    const cancel = content.querySelector('.modal-cancel');
    const close = (value) => {
      ok.removeEventListener('click', okHandler);
      cancel.removeEventListener('click', cancelHandler);
      overlay.removeEventListener('click', overlayHandler);
      document.removeEventListener('keydown', keyHandler);
      hideModal(overlay);
      resolve(value);
    };
    const okHandler = () => close(true);
    const cancelHandler = () => close(false);
    const overlayHandler = (e) => {
      if (e.target === overlay) cancelHandler();
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') cancelHandler();
      if (e.key === 'Enter') okHandler();
    };
    ok.addEventListener('click', okHandler);
    cancel.addEventListener('click', cancelHandler);
    overlay.addEventListener('click', overlayHandler);
    document.addEventListener('keydown', keyHandler);
    showModal(overlay);
    ok.focus();
  });
}

async function checkAuth() {
  const { authenticated } = await API.get('/auth/status');
  return authenticated;
}

function renderLogin() {
  const main = document.getElementById('main');
  const login = document.getElementById('login-screen');
  const loading = document.getElementById('loading');

  hide(main);
  show(login);
  hide(loading);
}

function renderApp() {
  const main = document.getElementById('main');
  const login = document.getElementById('login-screen');
  const loading = document.getElementById('loading');

  hide(login);
  show(main);
  hide(loading);
}

function renderAuthArea() {
  const area = document.getElementById('auth-area');
  area.innerHTML = '<button class="logout">Sign out</button>';
  area.querySelector('.logout').addEventListener('click', () => {
    fetch('/auth/logout', { method: 'POST' }).catch(() => {});
    area.innerHTML = '';
    renderLogin();
    document.getElementById('login-btn').onclick = initLogin;
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function getRouteFromHash() {
  const hash = (window.location.hash || '#home').slice(1);
  return hash === 'gmail' ? 'gmail' : 'home';
}

let homeDatetimeInterval = null;

function renderRoute(route) {
  const r = route === 'gmail' ? 'gmail' : 'home';
  const app = document.getElementById('app');
  app.dataset.route = r;
  document.querySelectorAll('.nav-tab').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === r);
  });
  document.querySelectorAll('.module-view').forEach((v) => {
    v.classList.toggle('hidden', v.dataset.route !== r);
  });
  document.querySelectorAll('.logo').forEach((el) => {
    if (el.dataset.route) el.style.display = el.dataset.route === r ? '' : 'none';
  });
  if (homeDatetimeInterval) {
    clearInterval(homeDatetimeInterval);
    homeDatetimeInterval = null;
  }
  if (r === 'home') {
    updateHomeContent();
    homeDatetimeInterval = setInterval(updateHomeDatetime, 1000);
  }
}

function initRoute() {
  const handleRoute = () => {
    const route = getRouteFromHash();
    renderRoute(route);
  };
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function formatDateTimeEST() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    timeStyle: 'long',
  });
  return { dateStr, timeStr };
}

function updateHomeDatetime() {
  const el = document.getElementById('home-datetime');
  if (!el) return;
  const { dateStr, timeStr } = formatDateTimeEST();
  el.innerHTML = `${escapeHtml(dateStr)}<br>at ${escapeHtml(timeStr)}`;
}

function getClientSessionInfo() {
  const conn = navigator.connection || {};
  const items = {
    'IP address': '—',
    'User agent': navigator.userAgent || '—',
    'Platform': navigator.platform || '—',
    'Language': navigator.language || '—',
    'Languages': navigator.languages?.join(', ') || '—',
    'Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || '—',
    'Online': navigator.onLine ? 'Yes' : 'No',
    'Cookies enabled': navigator.cookieEnabled ? 'Yes' : 'No',
    'Do not track': navigator.doNotTrack || '—',
    'Connection type': conn.effectiveType || '—',
    'Color depth': screen.colorDepth ? `${screen.colorDepth}-bit` : '—',
    'Pixel ratio': String(window.devicePixelRatio || 1),
    'Secure context': window.isSecureContext ? 'Yes' : 'No',
    'Referrer': document.referrer || '(none)',
  };
  if (conn.downlink != null) items['Downlink (Mbps)'] = String(conn.downlink);
  if (conn.rtt != null) items['RTT (ms)'] = String(conn.rtt);
  if (conn.saveData != null) items['Data saver'] = conn.saveData ? 'On' : 'Off';
  if (navigator.deviceMemory != null) items['Device memory (GB)'] = String(navigator.deviceMemory);
  if (navigator.hardwareConcurrency != null) items['CPU cores'] = String(navigator.hardwareConcurrency);
  items['Screen'] = `${screen.width}×${screen.height}`;
  items['Viewport'] = `${window.innerWidth}×${window.innerHeight}`;
  items['Origin'] = window.location.origin || '—';
  return items;
}

async function fetchAndMergeSessionInfo() {
  const client = getClientSessionInfo();
  try {
    const server = await API.get('/api/session-info');
    client['IP address'] = server.ip || '—';
  } catch {}
  return client;
}

function renderHomeSession(data) {
  const el = document.getElementById('home-session-list');
  if (!el) return;
  el.innerHTML = Object.entries(data)
    .map(([k, v]) => `<div class="home-session-entry"><span class="home-session-key">${escapeHtml(k)}:</span> ${escapeHtml(String(v))}</div>`)
    .join('');
}

async function loadHomeSession() {
  const data = await fetchAndMergeSessionInfo();
  renderHomeSession(data);
}

function updateHomeContent() {
  loadSavedLinks();
  loadHomeSession();
  updateHomeDatetime();
}

// --- Saved Links ---
let linksData = { categories: [] };
let addLinkCategoryId = null;
let editingLinkId = null;
let editingCategoryId = null;
let visibleCategoryIds = new Set();
const MAX_VISIBLE_CATEGORIES = 7;
let multiOpenCategoryId = null;
let multiOpenSelectedIds = new Set();

async function loadSavedLinks() {
  try {
    linksData = await API.get('/api/links');
    if (!linksData.categories) linksData.categories = [];
  } catch {
    linksData = { categories: [] };
  }
  initVisibleCategoryIds();
  renderSavedLinks();
}

function initVisibleCategoryIds() {
  const cats = linksData.categories || [];
  const existing = [...visibleCategoryIds].filter((id) => cats.some((c) => c.id === id));
  visibleCategoryIds = new Set(existing);
  for (const cat of cats) {
    if (visibleCategoryIds.size >= MAX_VISIBLE_CATEGORIES) break;
    visibleCategoryIds.add(cat.id);
  }
}

function renderCategoryList() {
  const container = document.getElementById('saved-links-category-list');
  if (!container) return;
  container.innerHTML = '';
  (linksData.categories || []).forEach((cat) => {
    const item = document.createElement('div');
    item.className = 'saved-links-category-list-item';
    if (visibleCategoryIds.has(cat.id)) item.classList.add('visible');
    item.dataset.categoryId = cat.id;
    item.textContent = cat.name;
    item.addEventListener('click', () => toggleCategoryVisible(cat.id));
    container.appendChild(item);
  });
}

function toggleCategoryVisible(categoryId) {
  if (visibleCategoryIds.has(categoryId)) {
    visibleCategoryIds.delete(categoryId);
  } else {
    if (visibleCategoryIds.size >= MAX_VISIBLE_CATEGORIES) {
      const first = visibleCategoryIds.values().next().value;
      visibleCategoryIds.delete(first);
    }
    visibleCategoryIds.add(categoryId);
  }
  renderSavedLinks();
}

async function saveSavedLinks() {
  try {
    linksData = await API.put('/api/links', { categories: linksData.categories });
  } catch (e) {
    await modalAlert(e?.message || 'Failed to save links');
  }
}

function renderSavedLinks() {
  const container = document.getElementById('saved-links-categories');
  if (!container) return;
  container.innerHTML = '';
  (linksData.categories || []).filter((cat) => visibleCategoryIds.has(cat.id)).forEach((cat) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'saved-links-category-wrapper';
    wrapper.dataset.categoryId = cat.id;
    const catEl = document.createElement('div');
    catEl.className = 'saved-links-category expanded' + (multiOpenCategoryId === cat.id ? ' multi-open-mode' : '');
    catEl.dataset.categoryId = cat.id;
    const header = document.createElement('div');
    header.className = 'saved-links-category-header';
    header.innerHTML = `
      <span class="saved-links-category-name">${escapeHtml(cat.name)}</span>
      <span class="saved-links-category-actions">
        <button type="button" class="saved-links-action-btn edit" data-action="edit-category" title="Edit">✎</button>
      </span>
    `;
    header.addEventListener('click', (e) => {
      if (!e.target.closest('.saved-links-action-btn')) {
        e.stopPropagation();
        const wasExpanded = catEl.classList.contains('expanded');
        document.querySelectorAll('#saved-links-categories .saved-links-category').forEach((c) => c.classList.remove('expanded'));
        if (!wasExpanded) catEl.classList.add('expanded');
      } else {
        const btn = e.target.closest('.saved-links-action-btn');
        if (btn.dataset.action === 'edit-category') handleEditCategory(cat.id);
      }
    });
    const linksDiv = document.createElement('div');
    linksDiv.className = 'saved-links-category-links';
    (cat.links || []).forEach((link) => {
      const linkEl = document.createElement('div');
      linkEl.className = 'saved-links-link';
      linkEl.dataset.linkId = link.id;
      linkEl.innerHTML = `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.displayName || link.url)}</a>
        <span class="saved-links-link-actions">
          <button type="button" class="saved-links-action-btn edit" data-link-id="${escapeHtml(link.id)}" title="Edit">✎</button>
        </span>
      `;
      linkEl.addEventListener('click', (e) => {
        if (e.target.closest('.saved-links-link-actions')) return;
        if (multiOpenCategoryId === cat.id) {
          e.preventDefault();
          toggleMultiOpenLink(cat.id, link.id, linkEl);
        }
      });
      linkEl.querySelector('.saved-links-link-actions').addEventListener('click', (e) => {
        const btn = e.target.closest('.saved-links-action-btn');
        if (!btn) return;
        e.preventDefault();
        handleEditLink(cat.id, btn.dataset.linkId);
      });
      if (multiOpenCategoryId === cat.id && multiOpenSelectedIds.has(link.id)) {
        linkEl.classList.add('multi-open-selected');
      }
      linksDiv.appendChild(linkEl);
    });
    const addLinkRow = document.createElement('div');
    addLinkRow.className = 'saved-links-add-link-row';
    const addLinkBtn = document.createElement('button');
    addLinkBtn.type = 'button';
    addLinkBtn.className = 'saved-links-add-link';
    addLinkBtn.textContent = multiOpenCategoryId === cat.id ? '×' : '+';
    addLinkBtn.title = multiOpenCategoryId === cat.id ? 'Cancel multi-open' : 'Add link';
    addLinkBtn.addEventListener('click', () => {
      if (multiOpenCategoryId === cat.id) {
        multiOpenCategoryId = null;
        multiOpenSelectedIds.clear();
        renderSavedLinks();
      } else {
        showAddLinkForm(cat.id);
      }
    });
    const openAllBtn = document.createElement('button');
    openAllBtn.type = 'button';
    openAllBtn.className = 'saved-links-open-all' + (multiOpenCategoryId === cat.id ? ' multi-open-active' : '');
    openAllBtn.innerHTML = multiOpenCategoryId === cat.id ? 'Open selected' : 'All <span class="open-all-arrow">→</span>';
    openAllBtn.title = multiOpenCategoryId === cat.id ? 'Open selected links in new tabs' : 'Multi-select links to open';
    openAllBtn.addEventListener('click', () => toggleMultiOpenMode(cat));
    addLinkRow.appendChild(addLinkBtn);
    addLinkRow.appendChild(openAllBtn);
    linksDiv.appendChild(addLinkRow);
    catEl.appendChild(header);
    catEl.appendChild(linksDiv);
    const categoryEditFlyout = document.createElement('div');
    categoryEditFlyout.className = 'category-edit-flyout';
    categoryEditFlyout.dataset.categoryId = cat.id;
    const linkFormContainer = document.createElement('div');
    linkFormContainer.className = 'link-form-flyout';
    linkFormContainer.dataset.categoryId = cat.id;
    wrapper.appendChild(catEl);
    wrapper.appendChild(categoryEditFlyout);
    wrapper.appendChild(linkFormContainer);
    container.appendChild(wrapper);
  });
  renderCategoryList();
}

function toggleMultiOpenMode(cat) {
  if (multiOpenCategoryId === cat.id) {
    const links = (cat.links || []).filter((l) => multiOpenSelectedIds.has(l.id));
    links.forEach((l) => {
      if (l?.url) window.open(l.url, '_blank', 'noopener,noreferrer');
    });
    multiOpenCategoryId = null;
    multiOpenSelectedIds.clear();
    renderSavedLinks();
  } else {
    multiOpenCategoryId = cat.id;
    multiOpenSelectedIds = new Set((cat.links || []).map((l) => l.id));
    renderSavedLinks();
  }
}

function toggleMultiOpenLink(categoryId, linkId, linkEl) {
  if (multiOpenSelectedIds.has(linkId)) {
    multiOpenSelectedIds.delete(linkId);
    linkEl.classList.remove('multi-open-selected');
  } else {
    multiOpenSelectedIds.add(linkId);
    linkEl.classList.add('multi-open-selected');
  }
}

function getLinkFormContainer(categoryId) {
  return document.querySelector(`.link-form-flyout[data-category-id="${categoryId}"]`);
}

function getCategoryEditFlyout(categoryId) {
  return document.querySelector(`.category-edit-flyout[data-category-id="${categoryId}"]`);
}

function clearLinkForm(categoryId) {
  const container = getLinkFormContainer(categoryId);
  if (container) container.innerHTML = '';
}

function showAddLinkForm(categoryId) {
  addLinkCategoryId = categoryId;
  clearLinkForm(categoryId);
  const formContainer = getLinkFormContainer(categoryId);
  if (!formContainer) return;
  const form = document.createElement('div');
  form.className = 'add-link-form';
  form.innerHTML = `
    <input type="url" id="add-link-url" class="add-link-input" placeholder="URL" />
    <input type="text" id="add-link-name" class="add-link-input" placeholder="Display name" />
    <div class="add-link-actions">
      <button type="button" id="add-link-submit" class="btn btn-primary btn-form">Add</button>
      <button type="button" id="add-link-cancel" class="btn btn-secondary btn-form">Cancel</button>
    </div>
  `;
  formContainer.appendChild(form);
  form.querySelector('#add-link-submit').addEventListener('click', () => submitAddLink());
  form.querySelector('#add-link-cancel').addEventListener('click', () => cancelAddLink());
}

function cancelAddLink() {
  if (addLinkCategoryId) clearLinkForm(addLinkCategoryId);
  addLinkCategoryId = null;
}

function showEditLinkForm(categoryId, linkId) {
  const cat = linksData.categories.find((c) => c.id === categoryId);
  const link = cat?.links?.find((l) => l.id === linkId);
  if (!link) return;
  editingCategoryId = categoryId;
  editingLinkId = linkId;
  clearLinkForm(categoryId);
  const formContainer = getLinkFormContainer(categoryId);
  if (!formContainer) return;
  const form = document.createElement('div');
  form.className = 'add-link-form';
  form.innerHTML = `
    <input type="url" id="edit-link-url" class="add-link-input" placeholder="URL" value="${escapeHtml(link.url)}" />
    <input type="text" id="edit-link-name" class="add-link-input" placeholder="Display name" value="${escapeHtml(link.displayName || link.url)}" />
    <div class="add-link-actions">
      <button type="button" id="edit-link-submit" class="btn btn-primary btn-form">Update</button>
      <button type="button" id="edit-link-cancel" class="btn btn-secondary btn-form">Cancel</button>
      <button type="button" id="edit-link-delete" class="btn btn-danger btn-form">Delete</button>
    </div>
  `;
  formContainer.appendChild(form);
  form.querySelector('#edit-link-submit').addEventListener('click', () => submitEditLink());
  form.querySelector('#edit-link-cancel').addEventListener('click', () => cancelEditLink());
  form.querySelector('#edit-link-delete').addEventListener('click', () => handleDeleteLinkFromForm());
}

function cancelEditLink() {
  if (editingCategoryId) clearLinkForm(editingCategoryId);
  editingCategoryId = null;
  editingLinkId = null;
}

async function handleDeleteLinkFromForm() {
  if (!editingCategoryId || !editingLinkId) return;
  const ok = await modalConfirm('Delete this link?');
  if (!ok) return;
  await handleDeleteLink(editingCategoryId, editingLinkId, true);
  cancelEditLink();
}

async function submitEditLink() {
  const urlInput = document.getElementById('edit-link-url');
  const nameInput = document.getElementById('edit-link-name');
  const url = urlInput?.value?.trim();
  const name = nameInput?.value?.trim();
  if (!url) {
    await modalAlert('URL is required');
    return;
  }
  const cat = linksData.categories.find((c) => c.id === editingCategoryId);
  const link = cat?.links?.find((l) => l.id === editingLinkId);
  if (!link) return;
  link.url = url;
  link.displayName = (name || url).trim();
  editingCategoryId = null;
  editingLinkId = null;
  await saveSavedLinks();
  cancelEditLink();
  renderSavedLinks();
}

async function submitAddLink() {
  const urlInput = document.getElementById('add-link-url');
  const nameInput = document.getElementById('add-link-name');
  const url = urlInput?.value?.trim();
  const name = nameInput?.value?.trim();
  if (!url) {
    await modalAlert('URL is required');
    return;
  }
  const cat = linksData.categories.find((c) => c.id === addLinkCategoryId);
  if (!cat) return;
  cat.links = cat.links || [];
  cat.links.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    url,
    displayName: name || url,
  });
  await saveSavedLinks();
  cancelAddLink();
  renderSavedLinks();
}

function handleEditCategory(categoryId) {
  showEditCategoryForm(categoryId);
}

function showEditCategoryForm(categoryId) {
  const cat = linksData.categories.find((c) => c.id === categoryId);
  if (!cat) return;
  editingCategoryId = categoryId;
  const flyout = getCategoryEditFlyout(categoryId);
  if (!flyout) return;
  flyout.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'add-link-form category-edit-form';
  form.innerHTML = `
    <input type="text" id="edit-category-name" class="add-link-input" placeholder="Category name" value="${escapeHtml(cat.name)}" />
    <div class="add-link-actions">
      <button type="button" id="edit-category-submit" class="btn btn-primary btn-form">Update</button>
      <button type="button" id="edit-category-cancel" class="btn btn-secondary btn-form">Cancel</button>
    </div>
  `;
  flyout.appendChild(form);
  form.querySelector('#edit-category-submit').addEventListener('click', () => submitEditCategory());
  form.querySelector('#edit-category-cancel').addEventListener('click', () => cancelEditCategory());
  form.querySelector('#edit-category-name').focus();
}

function cancelEditCategory() {
  if (editingCategoryId) {
    const flyout = getCategoryEditFlyout(editingCategoryId);
    if (flyout) flyout.innerHTML = '';
  }
  editingCategoryId = null;
}

async function submitEditCategory() {
  const input = document.getElementById('edit-category-name');
  const trimmed = input?.value?.trim();
  if (!trimmed) return;
  const cat = linksData.categories.find((c) => c.id === editingCategoryId);
  if (!cat) return;
  const exists = linksData.categories.some((c) => c.id !== editingCategoryId && c.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    await modalAlert('Category name already exists');
    return;
  }
  cat.name = trimmed;
  editingCategoryId = null;
  await saveSavedLinks();
  cancelEditCategory();
  renderSavedLinks();
}

async function handleDeleteCategory(categoryId) {
  const cat = linksData.categories.find((c) => c.id === categoryId);
  if (!cat) return;
  const ok = await modalConfirm(`Delete category "${cat.name}" and all its links?`);
  if (!ok) return;
  visibleCategoryIds.delete(categoryId);
  linksData.categories = linksData.categories.filter((c) => c.id !== categoryId);
  await saveSavedLinks();
  renderSavedLinks();
}

function handleEditLink(categoryId, linkId) {
  showEditLinkForm(categoryId, linkId);
}

async function handleDeleteLink(categoryId, linkId, skipConfirm = false) {
  const cat = linksData.categories.find((c) => c.id === categoryId);
  const link = cat?.links?.find((l) => l.id === linkId);
  if (!link) return;
  if (!skipConfirm) {
    const ok = await modalConfirm(`Delete "${link.displayName || link.url}"?`);
    if (!ok) return;
  }
  cat.links = cat.links.filter((l) => l.id !== linkId);
  await saveSavedLinks();
  renderSavedLinks();
}

function initSavedLinks() {
  document.getElementById('saved-links-aux-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('saved-links-category-list');
    if (panel) panel.classList.toggle('hidden');
  });
  document.getElementById('add-category-btn')?.addEventListener('click', async () => {
    const name = await modalPrompt('Category name:');
    if (!name?.trim()) return;
    const trimmed = name.trim();
    const exists = linksData.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      await modalAlert('Category name already exists');
      return;
    }
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    linksData.categories.push({
      id: newId,
      name: trimmed,
      links: [],
    });
    if (visibleCategoryIds.size < MAX_VISIBLE_CATEGORIES) {
      visibleCategoryIds.add(newId);
    }
    await saveSavedLinks();
    renderSavedLinks();
  });
}

function formatClauseValue(value, op) {
  if (!value) return '';
  if (value.includes(' ')) return `"${value}"`;
  return value;
}

function serializeClauses() {
  const clauses = [];
  document.querySelectorAll('.query-clause').forEach((row) => {
    const key = QUERY_OPERATORS.find((o) => o.label === row.dataset.operator)?.key;
    if (!key) return;
    const negated = row.dataset.negate === 'true';
    if (row.dataset.duration === 'true') {
      const num = row.querySelector('.query-clause-duration-num')?.value?.trim();
      const unit = row.querySelector('.query-clause-duration-unit')?.value;
      if (num && unit) clauses.push({ key, num, unit, negate: negated });
    } else if (row.dataset.size === 'true') {
      const num = row.querySelector('.query-clause-size-num')?.value?.trim();
      const unit = row.querySelector('.query-clause-size-unit')?.value;
      const direction = row.dataset.sizeDirection || 'larger';
      if (num && unit) clauses.push({ key, direction, num, unit, negate: negated });
    } else {
      const input = row.querySelector('.query-clause-input');
      const value = input?.value?.trim();
      if (value) clauses.push({ key, value, negate: negated });
    }
  });
  return clauses;
}

function restoreClauses(clauses) {
  const container = document.getElementById('query-clauses');
  container.innerHTML = '';
  clauses.forEach((c) => {
    const init = { ...c };
    delete init.key;
    if (c.key === 'older_than' || c.key === 'newer_than') {
      addClause(c.key, init);
    } else if (c.key === 'size') {
      addClause(c.key, init);
    } else {
      addClause(c.key, init);
    }
  });
}

function buildQueryFromClauses() {
  const negate = (row) => row.dataset.negate === 'true';
  const prefix = (row, str) => (negate(row) ? `-${str}` : str);

  const clauses = [...document.querySelectorAll('.query-clause')].map((row) => {
    if (row.dataset.duration === 'true') {
      const numInput = row.querySelector('.query-clause-duration-num');
      const unitSelect = row.querySelector('.query-clause-duration-unit');
      const op = row.dataset.operator;
      const num = numInput?.value?.trim();
      const unit = unitSelect?.value;
      if (!num || !unit) return null;
      return prefix(row, `${op}${num}${unit}`);
    }
    if (row.dataset.size === 'true') {
      const numInput = row.querySelector('.query-clause-size-num');
      const unitSelect = row.querySelector('.query-clause-size-unit');
      const direction = row.dataset.sizeDirection || 'larger';
      const num = numInput?.value?.trim();
      const unit = unitSelect?.value;
      if (!num || !unit) return null;
      const op = direction === 'larger' ? 'size:' : 'smaller:';
      return prefix(row, `${op}${num}${unit}`);
    }
    const op = row.dataset.operator;
    const isBare = row.dataset.bare === 'true';
    const input = row.querySelector('.query-clause-input');
    const select = row.querySelector('.query-clause-select');
    const raw = input ? input.value.trim() : (select ? select.value : '');
    const value = formatClauseValue(raw, op);
    if (!value) return null;
    const clause = isBare ? value : `${op}${value}`;
    return prefix(row, clause);
  }).filter(Boolean);
  return clauses.join(' ');
}

function formatLogTimestamp() {
  return new Date().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function renderLogEntry(timestamp, message) {
  const log = document.getElementById('action-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = 'action-log-entry';
  entry.textContent = `[${timestamp}]: ${message}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

async function logAction(message) {
  const timestamp = formatLogTimestamp();
  renderLogEntry(timestamp, message);
  try {
    await API.post('/api/action-log', { timestamp, message });
  } catch {
    // ignore persist failure
  }
}

function updateQueryPreview() {
  const preview = document.getElementById('query-preview-text');
  const gmailLink = document.getElementById('gmail-search-link');
  const copyBtn = document.getElementById('copy-query-btn');
  const saveBtn = document.getElementById('save-query-btn');
  const query = buildQueryFromClauses();
  preview.textContent = query || '— Add clauses below —';
  preview.classList.toggle('empty', !query);
  if (gmailLink) {
    if (query) show(gmailLink);
    else hide(gmailLink);
  }
  if (copyBtn) {
    if (query) show(copyBtn);
    else hide(copyBtn);
  }
  if (saveBtn) {
    if (query) show(saveBtn);
    else hide(saveBtn);
  }
}

function addClause(operatorKey, initial) {
  const op = QUERY_OPERATORS.find((o) => o.key === operatorKey);
  if (!op) return;

  const id = ++clauseId;
  const container = document.getElementById('query-clauses');

  const row = document.createElement('div');
  row.className = 'query-clause';
  row.dataset.id = id;
  row.dataset.operator = op.label;
  if (op.bare) row.dataset.bare = 'true';

  let valueEl = '';
  if (op.type === 'duration') {
    row.dataset.duration = 'true';
    valueEl = `
      <div class="query-clause-duration">
        <input type="number" class="query-clause-input query-clause-duration-num" placeholder="e.g. 1" min="1" inputmode="numeric" />
        <select class="query-clause-input query-clause-duration-unit">
          <option value="">Unit</option>
          <option value="d">days</option>
          <option value="m">months</option>
          <option value="y">years</option>
        </select>
      </div>
    `;
  } else if (op.type === 'size') {
    row.dataset.size = 'true';
    row.dataset.sizeDirection = 'larger';
    valueEl = `
      <div class="query-clause-size">
        <div class="query-clause-size-buttons">
          <button type="button" class="query-clause-size-btn active" data-direction="larger">Larger than</button>
          <button type="button" class="query-clause-size-btn" data-direction="smaller">Smaller than</button>
        </div>
        <input type="number" class="query-clause-input query-clause-size-num" placeholder="e.g. 5" min="0" step="any" inputmode="decimal" />
        <select class="query-clause-input query-clause-size-unit">
          <option value="">Unit</option>
          <option value="k">KB</option>
          <option value="m">MB</option>
          <option value="g">GB</option>
        </select>
      </div>
    `;
  } else if (op.type === 'text') {
    valueEl = `<input type="text" class="query-clause-input" placeholder="${escapeHtml(op.placeholder)}" data-operator="${escapeHtml(op.label)}" />`;
  } else {
    const opts = op.options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    valueEl = `<select class="query-clause-input query-clause-select" data-operator="${escapeHtml(op.label)}"><option value="">Select...</option>${opts}</select>`;
  }

  row.innerHTML = `
    <button type="button" class="query-clause-negate" title="Negate (NOT)"><span class="negate-icon"></span></button>
    <span class="query-clause-label">${escapeHtml(op.label)}</span>
    ${valueEl}
    <button type="button" class="query-clause-remove" title="Remove clause">✕</button>
  `;

  row.querySelector('.query-clause-negate').addEventListener('click', () => {
    row.dataset.negate = row.dataset.negate === 'true' ? 'false' : 'true';
    row.querySelector('.query-clause-negate').classList.toggle('active', row.dataset.negate === 'true');
    updateQueryPreview();
  });

  if (op.type === 'duration') {
    row.querySelector('.query-clause-duration-num')?.addEventListener('input', updateQueryPreview);
    row.querySelector('.query-clause-duration-unit')?.addEventListener('change', updateQueryPreview);
  } else if (op.type === 'size') {
    row.querySelectorAll('.query-clause-size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.query-clause-size-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        row.dataset.sizeDirection = btn.dataset.direction;
        updateQueryPreview();
      });
    });
    row.querySelector('.query-clause-size-num')?.addEventListener('input', updateQueryPreview);
    row.querySelector('.query-clause-size-unit')?.addEventListener('change', updateQueryPreview);
  } else {
    const input = row.querySelector('.query-clause-input');
    input?.addEventListener('input', updateQueryPreview);
    input?.addEventListener('change', updateQueryPreview);
  }

  row.querySelector('.query-clause-remove').addEventListener('click', () => {
    row.remove();
    updateQueryPreview();
  });

  if (initial) {
    if (initial.negate) {
      row.dataset.negate = 'true';
      row.querySelector('.query-clause-negate')?.classList.add('active');
    }
    if (op.type === 'duration') {
      const numEl = row.querySelector('.query-clause-duration-num');
      const unitEl = row.querySelector('.query-clause-duration-unit');
      if (numEl && initial.num != null) numEl.value = initial.num;
      if (unitEl && initial.unit) unitEl.value = initial.unit;
    } else if (op.type === 'size') {
      const dir = initial.direction || 'larger';
      row.dataset.sizeDirection = dir;
      row.querySelectorAll('.query-clause-size-btn').forEach((b) => b.classList.toggle('active', b.dataset.direction === dir));
      const numEl = row.querySelector('.query-clause-size-num');
      const unitEl = row.querySelector('.query-clause-size-unit');
      if (numEl && initial.num != null) numEl.value = initial.num;
      if (unitEl && initial.unit) unitEl.value = initial.unit;
    } else {
      const input = row.querySelector('.query-clause-input');
      if (input && initial.value != null) input.value = initial.value;
    }
  }

  container.appendChild(row);
  updateQueryPreview();
}

async function loadActionLog() {
  try {
    const entries = await API.get('/api/action-log');
    entries.forEach((e) => renderLogEntry(e.timestamp, e.message));
  } catch {
    // ignore
  }
}

async function loadSavedQueriesDropdown() {
  const select = document.getElementById('saved-queries-dropdown');
  if (!select) return;
  try {
    const queries = await API.get('/api/saved-queries');
    select.innerHTML = '<option value="">Load saved query…</option>';
    if (queries.length > 0) {
      queries.forEach((q) => {
        const opt = document.createElement('option');
        opt.value = q.id;
        opt.textContent = q.name;
        opt.dataset.clauses = JSON.stringify(q.clauses);
        select.appendChild(opt);
      });
      show(select);
    } else {
      hide(select);
    }
  } catch {
    hide(select);
  }
}

async function saveCurrentQuery() {
  const query = buildQueryFromClauses();
  if (!query) {
    alert('Add at least one clause with a value to save.');
    return;
  }
  const name = window.prompt('Name for this query:', query.slice(0, 40) + (query.length > 40 ? '…' : ''));
  if (!name?.trim()) return;
  try {
    await API.post('/api/saved-queries', { name: name.trim(), clauses: serializeClauses() });
    await loadSavedQueriesDropdown();
    logAction(`Saved query: ${name.trim()}`);
  } catch (e) {
    alert(e.message || 'Failed to save query');
  }
}

function loadSavedQuery(clauses) {
  if (!Array.isArray(clauses) || clauses.length === 0) return;
  restoreClauses(clauses);
}

function initQueryBuilder() {
  const addButtons = document.getElementById('query-add-buttons');
  addButtons.innerHTML = '';
  QUERY_OPERATORS.forEach((op) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'query-add-btn';
    btn.textContent = op.label;
    btn.addEventListener('click', () => addClause(op.key));
    addButtons.appendChild(btn);
  });
}

function initLogin() {
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');

  btn.disabled = true;
  hide(err);

  API.get('/auth/url')
    .then(({ url }) => {
      window.location.href = url;
    })
    .catch((e) => {
      err.textContent = e.message || 'Failed to get login URL';
      show(err);
      btn.disabled = false;
    });
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((p) => {
        if (p.id === `tab-panel-${tabId}`) {
          p.classList.remove('hidden');
          if (tabId === '1') loadAccountData();
        } else {
          p.classList.add('hidden');
        }
      });
    });
  });
}

function formatStorage(bytes) {
  if (bytes == null || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function loadAccountData() {
  const el = document.getElementById('account-data-content');
  if (!el) return;
  el.innerHTML = '<p class="tab-placeholder">Loading…</p>';
  try {
    const data = await API.get('/api/account-data');
    const used = formatStorage(data.storageUsed);
    const limit = data.storageLimit != null ? formatStorage(data.storageLimit) : null;
    const pct = data.storageLimit && data.storageLimit > 0
      ? ((data.storageUsed / data.storageLimit) * 100).toFixed(1)
      : null;

    const lc = data.labelCounts || {};
    const inboxUnread = lc.INBOX?.unread ?? '—';
    const totalUnread = lc.UNREAD?.total ?? '—';
    const sentTotal = lc.SENT?.total ?? '—';
    const trashTotal = lc.TRASH?.total ?? '—';
    const spamTotal = lc.SPAM?.total ?? '—';
    const draftsTotal = lc.DRAFT?.total ?? '—';

    const aliasesHtml = (data.aliases || []).length > 0
      ? (data.aliases || []).map((a) => escapeHtml(a)).join(', ')
      : '—';

    el.innerHTML = `
      <dl class="account-data-list">
        <dt>Email</dt>
        <dd>${escapeHtml(data.email)}</dd>
        <dt>Aliases</dt>
        <dd>${aliasesHtml}</dd>
        <dt>Messages</dt>
        <dd>${data.messagesTotal.toLocaleString()}</dd>
        <dt>Threads</dt>
        <dd>${data.threadsTotal.toLocaleString()}</dd>
        <dt>Inbox unread</dt>
        <dd>${typeof inboxUnread === 'number' ? inboxUnread.toLocaleString() : inboxUnread}</dd>
        <dt>Total unread</dt>
        <dd>${typeof totalUnread === 'number' ? totalUnread.toLocaleString() : totalUnread}</dd>
        <dt>Sent</dt>
        <dd>${typeof sentTotal === 'number' ? sentTotal.toLocaleString() : sentTotal}</dd>
        <dt>Trash</dt>
        <dd>${typeof trashTotal === 'number' ? trashTotal.toLocaleString() : trashTotal}</dd>
        <dt>Spam</dt>
        <dd>${typeof spamTotal === 'number' ? spamTotal.toLocaleString() : spamTotal}</dd>
        <dt>Drafts</dt>
        <dd>${typeof draftsTotal === 'number' ? draftsTotal.toLocaleString() : draftsTotal}</dd>
        <dt>Storage used</dt>
        <dd>${used}${limit ? ` of ${limit}` : ''}${pct != null ? ` (${pct}%)` : ''}</dd>
        <dt>Account age</dt>
        <dd class="account-muted">Not available for consumer accounts</dd>
      </dl>
      ${limit && pct != null ? `<div class="account-storage-bar"><div class="account-storage-fill" style="width: ${Math.min(100, parseFloat(pct))}%"></div></div>` : ''}
    `;
  } catch (e) {
    el.innerHTML = `<p class="tab-placeholder tab-error">${escapeHtml(e.message || 'Failed to load account data')}</p>`;
  }
}

function initSortHeaders() {
  document.querySelectorAll('.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDir = 'asc';
      }
      applySort();
      updateSortIcons();
    });
  });
}

function updateSortIcons() {
  document.querySelectorAll('.sortable .sort-icon').forEach((span) => {
    const th = span.closest('th');
    const col = th?.dataset.sort;
    span.textContent = sortColumn === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';
    span.setAttribute('aria-label', sortColumn === col ? `Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}` : 'Click to sort');
  });
}

function applySort() {
  if (!sortColumn) return;
  const list = document.getElementById('results-list');
  const rows = [...list.querySelectorAll('.result-row')];
  if (rows.length === 0) return;

  const getVal = (row) => {
    const v = row.dataset[sortColumn] ?? '';
    if (sortColumn === 'date') return v || '0';
    if (sortColumn === 'size') return parseInt(v, 10) || 0;
    return v;
  };

  rows.sort((a, b) => {
    const va = getVal(a);
    const vb = getVal(b);
    let cmp = 0;
    if (sortColumn === 'date') cmp = va.localeCompare(vb);
    else if (sortColumn === 'size') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  rows.forEach((r) => list.appendChild(r));
}

function updateResultsCount(displayedCount, totalEstimate) {
  const el = document.getElementById('results-count');
  if (!el) return;
  if (displayedCount === 0 && totalEstimate == null) {
    el.textContent = '';
    return;
  }
  if (totalEstimate != null) {
    el.textContent = `Displaying ${displayedCount} of ~${totalEstimate.toLocaleString()} total results`;
  } else {
    el.textContent = `Displaying ${displayedCount} results`;
  }
}

function renderResults(data) {
  const list = document.getElementById('results-list');
  const footer = document.getElementById('results-footer');

  list.innerHTML = '';
  currentResultSizeEstimate = data.resultSizeEstimate ?? null;

  if (!data.messages.length) {
    list.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <p>No messages found for this search.</p>
          <p>Try a different query or check your operators.</p>
        </td>
      </tr>
    `;
    footer.innerHTML = '';
    updateResultsCount(0, currentResultSizeEstimate);
    return;
  }

  data.messages.forEach((msg) => {
    const row = document.createElement('tr');
    row.className = 'result-row';
    row.dataset.id = msg.id;
    row.dataset.from = (msg.from || '').toLowerCase();
    row.dataset.date = msg.date || '';
    row.dataset.size = String(msg.sizeEstimate ?? 0);
    row.innerHTML = `
      <td class="col-check"><input type="checkbox" class="checkbox result-checkbox" data-id="${msg.id}" /></td>
      <td class="col-from" title="${escapeHtml(msg.from)}">${escapeHtml(msg.from)}</td>
      <td class="col-subject" title="${escapeHtml(msg.subject)}">${escapeHtml(msg.subject)}</td>
      <td class="col-date">${formatDate(msg.date)}</td>
      <td class="col-size">${formatSize(msg.sizeEstimate)}</td>
      <td class="col-preview" title="${escapeHtml(msg.snippet || '')}">${escapeHtml(msg.snippet || '')}</td>
      <td class="col-open"><a href="https://mail.google.com/mail/#all/${escapeHtml(msg.id)}" target="_blank" rel="noopener noreferrer" class="open-in-gmail" title="Open in Gmail">↗</a></td>
    `;

    row.querySelector('.result-checkbox').addEventListener('change', updateDeleteButton);
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.result-checkbox') && !e.target.closest('.open-in-gmail')) {
        const cb = row.querySelector('.result-checkbox');
        cb.checked = !cb.checked;
        updateDeleteButton();
      }
    });

    list.appendChild(row);
  });

  updateResultsCount(data.messages.length, currentResultSizeEstimate);

  if (data.nextPageToken) {
    footer.innerHTML = `
      <button class="btn btn-primary load-more-btn" id="load-more">Load more</button>
    `;
    document.getElementById('load-more').addEventListener('click', () => loadMore(data.nextPageToken));
  } else {
    const total = data.resultSizeEstimate ? ` ~${data.resultSizeEstimate} total` : '';
    footer.innerHTML = `Showing ${data.messages.length}${total} messages`;
  }

  document.getElementById('select-all').checked = false;
  document.getElementById('select-all').indeterminate = false;
  updateDeleteButton();
  applySort();
  updateSortIcons();
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes) {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getBatchSize() {
  const input = document.getElementById('batch-size');
  if (!input) return 50;
  const n = parseInt(input.value, 10);
  if (Number.isNaN(n) || n < 5) return 5;
  if (n > 500) return 500;
  return n;
}

function getSelectedIds() {
  return [...document.querySelectorAll('.result-checkbox:checked')].map((c) => c.dataset.id);
}

function updateDeleteButton() {
  const ids = getSelectedIds();
  const btn = document.getElementById('delete-btn');
  const countEl = document.getElementById('selected-count');
  const selectAll = document.getElementById('select-all');

  countEl.textContent = ids.length;
  btn.disabled = ids.length === 0;

  document.querySelectorAll('.result-row').forEach((row) => {
    const cb = row.querySelector('.result-checkbox');
    row.classList.toggle('selected', cb?.checked);
  });

  const checkboxes = document.querySelectorAll('.result-checkbox');
  const checked = checkboxes.length ? [...checkboxes].filter((c) => c.checked).length : 0;
  selectAll.checked = checked === checkboxes.length && checkboxes.length > 0;
  selectAll.indeterminate = checked > 0 && checked < checkboxes.length;
}

async function runSearch() {
  const query = buildQueryFromClauses();
  if (!query) {
    alert('Add at least one clause with a value to execute.');
    return;
  }

  const loading = document.getElementById('loading');
  show(loading);

  currentQuery = query;
  currentPageToken = null;

  const maxResults = getBatchSize();
  try {
    const data = await API.post('/api/search', { query, maxResults });
    renderResults(data);
    logAction(`Searched: ${query}`);
  } catch (e) {
    alert(e.message || 'Search failed');
  } finally {
    hide(loading);
  }
}

async function loadMore(pageToken) {
  const loading = document.getElementById('loading');
  show(loading);

  const maxResults = getBatchSize();
  try {
    const data = await API.post('/api/search', { query: currentQuery, pageToken, maxResults });
    const list = document.getElementById('results-list');
    const footer = document.getElementById('results-footer');

    footer.innerHTML = '';

    data.messages.forEach((msg) => {
      const row = document.createElement('tr');
      row.className = 'result-row';
      row.dataset.id = msg.id;
      row.dataset.from = (msg.from || '').toLowerCase();
      row.dataset.date = msg.date || '';
      row.dataset.size = String(msg.sizeEstimate ?? 0);
      row.innerHTML = `
        <td class="col-check"><input type="checkbox" class="checkbox result-checkbox" data-id="${msg.id}" /></td>
        <td class="col-from" title="${escapeHtml(msg.from)}">${escapeHtml(msg.from)}</td>
        <td class="col-subject" title="${escapeHtml(msg.subject)}">${escapeHtml(msg.subject)}</td>
        <td class="col-date">${formatDate(msg.date)}</td>
        <td class="col-size">${formatSize(msg.sizeEstimate)}</td>
        <td class="col-preview" title="${escapeHtml(msg.snippet || '')}">${escapeHtml(msg.snippet || '')}</td>
        <td class="col-open"><a href="https://mail.google.com/mail/#all/${escapeHtml(msg.id)}" target="_blank" rel="noopener noreferrer" class="open-in-gmail" title="Open in Gmail">↗</a></td>
      `;
      row.querySelector('.result-checkbox').addEventListener('change', updateDeleteButton);
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.result-checkbox')) {
          const cb = row.querySelector('.result-checkbox');
          cb.checked = !cb.checked;
          updateDeleteButton();
        }
      });
      list.appendChild(row);
    });

    const displayedCount = document.querySelectorAll('.result-row').length;
    updateResultsCount(displayedCount, currentResultSizeEstimate);

    if (data.nextPageToken) {
      const footerDiv = document.getElementById('results-footer');
      footerDiv.innerHTML = `<button class="btn btn-primary load-more-btn" id="load-more">Load more</button>`;
      document.getElementById('load-more').addEventListener('click', () => loadMore(data.nextPageToken));
    } else {
      document.getElementById('results-footer').innerHTML = `Showing all loaded messages`;
    }

    applySort();
    updateDeleteButton();
  } catch (e) {
    alert(e.message || 'Failed to load more');
  } finally {
    hide(loading);
  }
}

async function doTrash() {
  const ids = getSelectedIds();
  if (!ids.length) return;
  if (!confirm(`Move ${ids.length} message(s) to Trash?`)) return;

  const btn = document.getElementById('delete-btn');
  btn.disabled = true;

  try {
    await API.post('/api/trash', { messageIds: ids });
    ids.forEach((id) => {
      const row = document.querySelector(`tr.result-row[data-id="${id}"]`);
      row?.remove();
    });
    const displayedCount = document.querySelectorAll('.result-row').length;
    updateResultsCount(displayedCount, currentResultSizeEstimate);
    updateDeleteButton();
    logAction(`Deleted ${ids.length} item${ids.length === 1 ? '' : 's'}`);
  } catch (e) {
    alert(e.message || 'Failed to move to trash');
  } finally {
    btn.disabled = false;
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error')) {
    document.getElementById('login-error').textContent =
      params.get('error') === 'auth_failed' ? 'Authentication failed. Please try again.' : 'Something went wrong.';
    show(document.getElementById('login-error'));
  }

  const authenticated = await checkAuth();

  if (authenticated) {
    renderApp();
    renderAuthArea();
    initQueryBuilder();
    loadSavedQueriesDropdown();
    loadActionLog();
    initRoute();
    initSavedLinks();
  } else {
    renderLogin();
    document.getElementById('login-btn').onclick = initLogin;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('execute-btn').addEventListener('click', runSearch);

  document.getElementById('select-all').addEventListener('change', (e) => {
    document.querySelectorAll('.result-checkbox').forEach((cb) => {
      cb.checked = e.target.checked;
    });
    updateDeleteButton();
  });

  document.getElementById('delete-btn').addEventListener('click', doTrash);

  document.getElementById('copy-query-btn').addEventListener('click', () => {
    const query = buildQueryFromClauses();
    if (query) {
      navigator.clipboard.writeText(query).catch(() => {});
    }
  });

  document.getElementById('gmail-search-link').addEventListener('click', (e) => {
    e.preventDefault();
    const query = buildQueryFromClauses();
    const url = query
      ? `https://mail.google.com/mail/#search/${encodeURIComponent(query)}`
      : 'https://mail.google.com/mail/#inbox';
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  document.getElementById('save-query-btn').addEventListener('click', saveCurrentQuery);

  initSortHeaders();
  updateSortIcons();
  initTabs();

  document.getElementById('saved-queries-dropdown').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (!opt?.value) return;
    try {
      const clauses = JSON.parse(opt.dataset.clauses || '[]');
      loadSavedQuery(clauses);
    } catch {}
    e.target.selectedIndex = 0;
  });
});
