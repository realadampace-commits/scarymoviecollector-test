import { getSupabaseClient } from '../supabase-client.js';
import { listForumCategories, listForumPosts, createForumCategory } from '../data/forums.js';
import { getSession } from '../auth.js';
import { escapeHtml } from '../ui.js';
import { formatShortDate } from '../utils/date.js';

const client = getSupabaseClient();
const list = document.getElementById('list');
const status = document.getElementById('status');
const posts = document.getElementById('posts');
const adminTools = document.getElementById('adminTools');
const categoryForm = document.getElementById('categoryForm');
const adminStatus = document.getElementById('adminStatus');
const initials = (value) => String(value || 'U').slice(0, 1).toUpperCase();
const when = (value) => formatShortDate(value, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function postCard(post) {
  return `<article class="post"><a aria-label="Open discussion: ${escapeHtml(post.title || '(untitled)')}" href="forum_post.html?id=${encodeURIComponent(post.id)}"><div class="post-top"><span class="avatar">${escapeHtml(initials(post.author_id))}</span><div><div class="author">Community member</div><div class="when">${escapeHtml(when(post.created_at))}</div></div></div><h2>${escapeHtml(post.title || '(untitled)')}</h2><p class="post-body">${escapeHtml(post.body || '')}</p><div class="post-foot">Open discussion →</div></a></article>`;
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
  list.innerHTML = categories.map((category, index) => `<a class="category" style="--cover:url('${escapeHtml(category.cover_image_url || '')}');--hue:${index * 37}" href="forum_category.html?id=${encodeURIComponent(category.id)}"><span class="badge"><svg aria-hidden="true"><use href="#forum-icon"/></svg></span><span><strong>${escapeHtml(category.title)}</strong>${category.description ? `<small>${escapeHtml(category.description)}</small>` : ''}</span></a>`).join('');
  posts.innerHTML = recentPosts.map(postCard).join('') || '<div class="panel empty">No posts yet. Choose a category to start the first discussion.</div>';
}

function renderLoadError(error) {
  console.error(error);
  list.innerHTML = '';
  posts.setAttribute('aria-busy', 'false');
  status.setAttribute('aria-busy', 'false');
  posts.setAttribute('aria-busy', 'false');
  status.textContent = 'Unable to load categories right now.';
  posts.innerHTML = '<div class="panel empty" role="alert">Unable to load the community feed right now. <button class="retry-forum" type="button">Retry loading the forum</button></div>';
}

posts.addEventListener('click', (event) => {
  if (event.target.closest('.retry-forum')) loadForum().catch(renderLoadError);
});

async function setupAdminTools() {
  const session = await getSession(client);
  if (!session?.user?.id) return;
  const { data: profile } = await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  if (['moderator', 'owner'].includes(profile?.role)) adminTools.hidden = false;
}

categoryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(categoryForm);
  adminStatus.textContent = 'Adding category…';
  try {
    await createForumCategory(client, { title: form.get('title'), description: form.get('description'), coverImageUrl: form.get('coverImageUrl') });
    categoryForm.reset();
    adminStatus.textContent = 'Category added.';
    await loadForum();
  } catch (error) {
    console.error(error);
    adminStatus.textContent = 'Unable to add category. Check the fields and try again.';
  }
});

setupAdminTools().catch(() => {});
loadForum().catch(renderLoadError);
