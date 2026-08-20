import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { getForumCategory, listForumChildren, listCategoryPosts } from '../data/forums.js';
import { escapeHtml } from '../ui.js';

const id = new URLSearchParams(location.search).get('id');
const title = document.getElementById('catTitle');
const childrenCard = document.getElementById('childrenCard');
const childrenList = document.getElementById('childrenList');
const postsCard = document.getElementById('postsCard');
const postsStatus = document.getElementById('postsStatus');
const postsList = document.getElementById('postsList');
const postActions = document.getElementById('postActions');
const initials = (value) => String(value || 'U').slice(0, 1).toUpperCase();
const when = (value) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

if (!id) { location.href = 'forum.html'; throw new Error('missing category id'); }
function postCard(post) {
  return `<article class="post"><a href="forum_post.html?id=${encodeURIComponent(post.id)}"><div class="post-top"><span class="avatar">${escapeHtml(initials(post.author_id))}</span><div><div class="author">Community member</div><div class="when">${escapeHtml(when(post.created_at))}</div></div></div><h2>${escapeHtml(post.title || '(untitled)')}</h2><p class="post-body">${escapeHtml(post.body || '')}</p><div class="post-foot">Open discussion →</div></a></article>`;
}

try {
  const client = getSupabaseClient();
  const [category, children, session] = await Promise.all([getForumCategory(client, id), listForumChildren(client, id), getSession(client)]);
  if (!category) { title.textContent = 'Category not found'; throw new Error('category not found'); }
  title.textContent = category.title;
  if (children.length) {
    childrenCard.style.display = '';
    childrenList.innerHTML = children.map((child) => `<a class="subcat-row" href="forum_category.html?id=${encodeURIComponent(child.id)}"><span class="badge">#</span><span>${escapeHtml(child.title)}</span></a>`).join('');
    postsCard.style.display = 'none';
  } else {
    if (session) postActions.innerHTML = `<a class="new-post" href="forum_new_post.html?cat=${encodeURIComponent(id)}">Create post</a>`;
    const posts = await listCategoryPosts(client, id);
    postsStatus.textContent = posts.length ? '' : 'No posts yet. Be the first to start this discussion.';
    postsList.innerHTML = posts.map(postCard).join('');
  }
} catch (error) {
  console.error(error);
  if (title.textContent === 'Loading…') title.textContent = 'Unable to load category.';
  postsStatus.textContent = 'Unable to load posts right now.';
}
