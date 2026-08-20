import { getSupabaseClient } from '../supabase-client.js';
import { listForumCategories, listForumPosts } from '../data/forums.js';
import { escapeHtml } from '../ui.js';
import { formatShortDate } from '../utils/date.js';

const client = getSupabaseClient();
const list = document.getElementById('list');
const status = document.getElementById('status');
const posts = document.getElementById('posts');
const initials = (value) => String(value || 'U').slice(0, 1).toUpperCase();
const when = (value) => formatShortDate(value, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function postCard(post) {
  return `<article class="post"><a href="forum_post.html?id=${encodeURIComponent(post.id)}"><div class="post-top"><span class="avatar">${escapeHtml(initials(post.author_id))}</span><div><div class="author">Community member</div><div class="when">${escapeHtml(when(post.created_at))}</div></div></div><h2>${escapeHtml(post.title || '(untitled)')}</h2><p class="post-body">${escapeHtml(post.body || '')}</p><div class="post-foot">Open discussion →</div></a></article>`;
}

async function loadForum() {
  status.textContent = 'Loading categories…';
  status.setAttribute('aria-busy', 'true');
  posts.setAttribute('aria-busy', 'true');
  list.innerHTML = '';
  posts.innerHTML = '<div class="panel empty" role="status">Loading community posts…</div>';
  const [categories, recentPosts] = await Promise.all([listForumCategories(client), listForumPosts(client, { limit: 25 })]);
  status.setAttribute('aria-busy', 'false');
  posts.setAttribute('aria-busy', 'false');
  status.textContent = categories.length ? '' : 'No categories yet.';
  list.innerHTML = categories.map((category) => `<a class="category" href="forum_category.html?id=${encodeURIComponent(category.id)}"><span class="badge">#</span><span>${escapeHtml(category.title)}</span></a>`).join('');
  posts.innerHTML = recentPosts.map(postCard).join('') || '<div class="panel empty">No posts yet. Choose a category to start the first discussion.</div>';
}

function renderLoadError(error) {
  console.error(error);
  status.setAttribute('aria-busy', 'false');
  posts.setAttribute('aria-busy', 'false');
  status.textContent = 'Unable to load categories right now.';
  posts.innerHTML = '<div class="panel empty">Unable to load the community feed right now. <button class="retry-forum" type="button">Retry loading the forum</button></div>';
}

posts.addEventListener('click', (event) => {
  if (event.target.closest('.retry-forum')) loadForum().catch(renderLoadError);
});

loadForum().catch(renderLoadError);
