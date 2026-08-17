import { getSupabaseClient } from '../supabase-client.js';
import { listRecentItems } from '../data/items.js';
import { escapeHtml, formatUsd } from '../ui.js';

const listEl = document.getElementById('list');
const msgEl = document.getElementById('msg');

try {
  const items = await listRecentItems(getSupabaseClient());
  msgEl.textContent = items.length ? '' : 'No items yet.';
  listEl.innerHTML = items.map((item) => `
    <a class="tile" href="item.html?id=${encodeURIComponent(item.id)}">
      <div class="thumb">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="">` : '<span class="muted">No image</span>'}</div>
      <div class="meta"><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${formatUsd(item.user_value)}</span></div>
    </a>
  `).join('');
} catch (error) {
  console.error(error);
  msgEl.textContent = 'Unable to load items right now.';
}
