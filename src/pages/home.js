import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { homeActionsForSession } from '../data/home-actions.js';
import { listRecentItems } from '../data/items.js';
import { escapeHtml, formatUsd } from '../ui.js';

const listEl = document.getElementById('list');
const msgEl = document.getElementById('msg');
const addItemAction = document.getElementById('addItemAction');
const settingsAction = document.getElementById('settingsAction');

function renderActions(session) {
  const actions = homeActionsForSession(session);
  addItemAction.href = actions.addItem.href;
  addItemAction.textContent = actions.addItem.label;
  settingsAction.href = actions.settings.href;
  settingsAction.textContent = actions.settings.label;
  document.body.classList.remove('auth-pending');
}

const client = getSupabaseClient();

async function loadHome() {
  msgEl.textContent = 'Loading items…';
  listEl.innerHTML = '';
  const session = await getSession(client).catch((error) => {
    console.warn('Home auth-state load failed:', error);
    return null;
  });
  renderActions(session);
  const items = await listRecentItems(client);
  msgEl.textContent = items.length ? '' : 'No items yet.';
  listEl.innerHTML = items.map((item) => `
    <a class="tile" href="item.html?id=${encodeURIComponent(item.id)}">
      <div class="thumb">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="">` : '<span class="muted">No image</span>'}</div>
      <div class="meta"><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${formatUsd(item.user_value)}</span></div>
    </a>
  `).join('');
}

function renderLoadError(error) {
  console.error('Home item load failed:', error);
  renderActions(null);
  msgEl.innerHTML = 'Unable to load items right now. <button class="retry-home" type="button">Retry loading items</button>';
}

msgEl.addEventListener('click', (event) => {
  if (event.target.closest('.retry-home')) loadHome().catch(renderLoadError);
});

loadHome().catch(renderLoadError);
