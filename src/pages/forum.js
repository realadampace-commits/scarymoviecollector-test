import { getSupabaseClient } from '../supabase-client.js';
import { listForumCategories } from '../data/forums.js';
import { escapeHtml } from '../ui.js';

const list = document.getElementById('list');
const status = document.getElementById('status');
try {
  const categories = await listForumCategories(getSupabaseClient());
  status.textContent = categories.length ? '' : 'No categories yet.';
  list.innerHTML = categories.map((category) => `<li class="node"><div class="row"><strong>${escapeHtml(category.title)}</strong><a class="btn" href="forum_category.html?id=${encodeURIComponent(category.id)}">Open</a></div></li>`).join('');
} catch (error) {
  console.error(error);
  status.textContent = 'Unable to load categories right now.';
}
