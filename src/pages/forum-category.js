import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { getForumCategory, getForumPostEngagement, listForumChildren, listCategoryPosts } from '../data/forums.js';
import { escapeHtml } from '../ui.js';
import { formatShortDate } from '../utils/date.js';

const id = new URLSearchParams(location.search).get('id');
const title = document.getElementById('catTitle');
const childrenCard = document.getElementById('childrenCard');
const childrenList = document.getElementById('childrenList');
const postsCard = document.getElementById('postsCard');
const postsStatus = document.getElementById('postsStatus');
const postsList = document.getElementById('postsList');
const postActions = document.getElementById('postActions');
const initials = (value) => String(value || 'U').slice(0, 1).toUpperCase();
const when = (value) => formatShortDate(value, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

if (!id) { location.href = 'forum.html'; throw new Error('missing category id'); }
function postCard(post, profile, engagement) {
  const displayName = profile?.username || 'Community member';
  const avatar = profile?.avatar_url ? `<img class="avatar-photo" src="${escapeHtml(profile.avatar_url)}" alt="">` : `<span class="avatar-initial">${escapeHtml(initials(displayName))}</span>`;
  const frame = profile?.frame_url ? `<img class="avatar-frame" src="${escapeHtml(profile.frame_url)}" alt="">` : '';
  const commentLabel = `${engagement.replies.length} comment${engagement.replies.length === 1 ? '' : 's'}`;
  return `<article class="post"><div class="post-top"><span class="avatar">${avatar}${frame}</span><div><div class="author">${escapeHtml(displayName)}</div><div class="when">${escapeHtml(when(post.created_at))} · 🌐</div></div><a class="post-more" aria-label="Open discussion" href="forum_post.html?id=${encodeURIComponent(post.id)}">•••</a></div><a class="post-content" href="forum_post.html?id=${encodeURIComponent(post.id)}"><h2>${escapeHtml(post.title || '(untitled)')}</h2><p class="post-body">${escapeHtml(post.body || '')}</p></a><div class="post-stats"><span>${engagement.likes.count ? `♡ ${engagement.likes.count}` : 'Be the first to like this'}</span><span>${commentLabel}</span></div><div class="post-actions"><a href="forum_post.html?id=${encodeURIComponent(post.id)}">♡ Like</a><a href="forum_post.html?id=${encodeURIComponent(post.id)}">💬 Comment</a><a href="forum_post.html?id=${encodeURIComponent(post.id)}">↗ Share</a></div></article>`;
}

async function loadCategory() {
try {
  postsStatus.hidden = false;
  postsStatus.textContent = 'Loading posts…';
  postsList.replaceChildren();
  postsCard.setAttribute('aria-busy', 'true');
  const client = getSupabaseClient();
  const [category, children, session] = await Promise.all([getForumCategory(client, id), listForumChildren(client, id), getSession(client)]);
  if (!category) { title.textContent = 'Category not found'; throw new Error('category not found'); }
  title.textContent = category.title;
  document.getElementById('catDescription').textContent = category.description || 'Posts stay organized in this category.';
  const banner = document.getElementById('categoryBanner');
  if (category.cover_image_url) banner.style.setProperty('--banner', `url("${String(category.cover_image_url).replaceAll('"', '')}")`);
  if (children.length) {
    childrenList.innerHTML = children.map((child) => `<a class="subcat-row" href="forum_category.html?id=${encodeURIComponent(child.id)}"><span class="badge">#</span><span>${escapeHtml(child.title)}</span></a>`).join('');
    childrenCard.style.display = '';
    postsCard.style.display = 'none';
  } else {
    const returnUrl = `forum_category.html?id=${encodeURIComponent(id)}`;
    postActions.innerHTML = session
      ? `<a class="new-post" href="forum_new_post.html?cat=${encodeURIComponent(id)}">Create post</a>`
      : `<a class="new-post" href="login.html?next=${encodeURIComponent(returnUrl)}">Sign in to post</a>`;
    const posts = await listCategoryPosts(client, id);
    const engagement = await getForumPostEngagement(client, posts.map((post) => post.id), session?.user?.id);
    const authorIds = [...new Set(posts.map((post) => post.author_id).filter(Boolean))];
    const { data: profiles } = authorIds.length ? await client.from('profiles').select('id,username,avatar_url,frame_url').in('id', authorIds) : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    postsStatus.textContent = posts.length ? '' : 'No posts yet. Be the first to start this discussion.';
    postsStatus.hidden = Boolean(posts.length);
    postsList.innerHTML = posts.map((post) => postCard(post, profileMap.get(post.author_id), engagement.get(post.id))).join('');
  }
  postsCard.removeAttribute('aria-busy');
} catch (error) {
  console.error(error);
  postsCard.removeAttribute('aria-busy');
  if (title.textContent === 'Loading…') title.textContent = 'Unable to load category.';
  postsStatus.hidden = false;
  postsStatus.innerHTML = 'Unable to load posts right now. <button class="retry-category" type="button">Retry loading category</button>';
}
}

postsStatus.addEventListener('click', (event) => {
  if (event.target.closest('.retry-category')) loadCategory();
});

loadCategory();
