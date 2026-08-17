import { getSupabaseClient } from '../supabase-client.js';
import { getForumCategory, listForumChildren, listCategoryPosts } from '../data/forums.js';
import { escapeHtml } from '../ui.js';

const id = new URLSearchParams(location.search).get('id');
const title = document.getElementById('catTitle');
const childrenCard = document.getElementById('childrenCard');
const childrenList = document.getElementById('childrenList');
const postsCard = document.getElementById('postsCard');
const postsStatus = document.getElementById('postsStatus');
const postsList = document.getElementById('postsList');

if (!id) { location.href = 'forum.html'; throw new Error('missing category id'); }
try {
  const client = getSupabaseClient();
  const category = await getForumCategory(client, id);
  if (!category) { title.textContent = 'Category not found'; throw new Error('category not found'); }
  title.textContent = category.title;
  const children = await listForumChildren(client, id);
  if (children.length) {
    childrenCard.style.display = '';
    childrenList.innerHTML = children.map((child) => `<li class="node"><div class="row"><strong>${escapeHtml(child.title)}</strong><a class="btn" href="forum_category.html?id=${encodeURIComponent(child.id)}">Open</a></div></li>`).join('');
  } else {
    postsCard.style.display = '';
    const posts = await listCategoryPosts(client, id);
    postsStatus.textContent = posts.length ? '' : 'No posts yet.';
    postsList.innerHTML = posts.map((post) => `<li class="node"><div class="row"><a class="btn" href="forum_post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title || '(untitled)')}</a><span class="muted">${new Date(post.created_at).toLocaleString()}</span></div></li>`).join('');
  }
} catch (error) {
  console.error(error);
  if (title.textContent === 'Loading…') title.textContent = 'Unable to load category.';
  if (postsStatus) postsStatus.textContent = 'Unable to load posts right now.';
}
