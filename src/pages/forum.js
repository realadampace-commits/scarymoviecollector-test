import { getSupabaseClient } from '../supabase-client.js';
import { listForumCategories, listForumPosts, listForumReplies, createForumReply, getForumPostLikeState, toggleForumPostLike, createForumCategory } from '../data/forums.js';
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

async function postCard(post, session) {
  const [likes, replies] = await Promise.all([getForumPostLikeState(client, post.id, session?.user?.id), listForumReplies(client, post.id)]);
  return `<article class="post" data-post-id="${post.id}" data-liked="${likes.liked}"><div class="post-top"><span class="avatar">${escapeHtml(initials(post.author_id))}</span><div><div class="author">Community member</div><div class="when">${escapeHtml(when(post.created_at))} · 🌐</div></div><a class="post-more" aria-label="Open discussion" href="forum_post.html?id=${encodeURIComponent(post.id)}">•••</a></div><a class="post-content" href="forum_post.html?id=${encodeURIComponent(post.id)}"><h2>${escapeHtml(post.title || '(untitled)')}</h2><p class="post-body">${escapeHtml(post.body || '')}</p></a><div class="post-stats"><span class="like-count">${likes.count ? `♡ ${likes.count}` : 'Be the first to like this'}</span><span class="reply-count">${replies.length} comment${replies.length === 1 ? '' : 's'}</span></div><div class="post-actions"><button class="feed-like${likes.liked ? ' liked' : ''}" type="button">${likes.liked ? '♥ Liked' : '♡ Like'}</button><button class="feed-comment" type="button">💬 Comment</button><button class="feed-share" type="button">↗ Share</button></div><div class="inline-comments" hidden><div class="comment-list">${replies.map((r) => `<p><strong>${escapeHtml(initials(r.author_id))}</strong> ${escapeHtml(r.body)}</p>`).join('')}</div><form class="inline-comment-form"><input name="body" maxlength="2000" placeholder="Write a comment…" required><button type="submit">Post</button><small class="comment-status" role="status"></small></form></div></article>`;
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
  const session = await getSession(client);
  posts.innerHTML = (await Promise.all(recentPosts.map((post) => postCard(post, session)))).join('') || '<div class="panel empty">No posts yet. Choose a category to start the first discussion.</div>';
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

posts.addEventListener('click', async (event) => {
  if (event.target.closest('.retry-forum')) return loadForum().catch(renderLoadError);
  const card = event.target.closest('[data-post-id]');
  if (!card) return;
  const session = await getSession(client);
  if (event.target.closest('.feed-comment')) { card.querySelector('.inline-comments').hidden = false; card.querySelector('input')?.focus(); return; }
  if (event.target.closest('.feed-share')) { await navigator.clipboard?.writeText(new URL(`forum_post.html?id=${card.dataset.postId}`, location.href).href); event.target.closest('.feed-share').textContent = '✓ Copied'; return; }
  const like = event.target.closest('.feed-like');
  if (like) {
    if (!session) { like.textContent = 'Sign in to like'; return; }
    like.disabled = true;
    try { const state = await toggleForumPostLike(client, { postId: card.dataset.postId, userId: session.user.id, liked: card.dataset.liked === 'true' }); card.dataset.liked = String(state.liked); like.classList.toggle('liked', state.liked); like.textContent = state.liked ? '♥ Liked' : '♡ Like'; card.querySelector('.like-count').textContent = state.count ? `♡ ${state.count}` : 'Be the first to like this'; } catch (error) { like.textContent = error.message || 'Unable to like'; } finally { like.disabled = false; }
  }
});

posts.addEventListener('submit', async (event) => {
  const form = event.target.closest('.inline-comment-form'); if (!form) return;
  event.preventDefault(); const session = await getSession(client); const card = form.closest('[data-post-id]'); const msg = form.querySelector('.comment-status');
  if (!session) { msg.textContent = 'Sign in to comment.'; return; }
  const input = form.elements.body; const body = input.value.trim(); if (!body) return;
  try { await createForumReply(client, { postId: card.dataset.postId, authorId: session.user.id, body }); input.value = ''; msg.textContent = 'Posted.'; const replies = await listForumReplies(client, card.dataset.postId); card.querySelector('.comment-list').innerHTML = replies.map((r) => `<p><strong>${escapeHtml(initials(r.author_id))}</strong> ${escapeHtml(r.body)}</p>`).join(''); card.querySelector('.reply-count').textContent = `${replies.length} comment${replies.length === 1 ? '' : 's'}`; } catch (error) { msg.textContent = error.message || 'Unable to comment.'; }
});

async function setupAdminTools() {
  const session = await getSession(client);
  if (!session?.user?.id) return;
  const { data: profile } = await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  if (['moderator', 'owner'].includes(profile?.role)) adminTools.hidden = false;
}

categoryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminStatus.textContent = 'Adding category…';
  try {
    const form = new FormData(categoryForm);
    let coverImageUrl = form.get('coverImageUrl');
    const coverFile = form.get('coverFile');
    if (coverFile?.size) {
      if (coverFile.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(coverFile.type)) throw new TypeError('invalid banner image');
      const path = `${crypto.randomUUID()}-${coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const upload = await client.storage.from('forum-covers').upload(path, coverFile, { upsert: false, contentType: coverFile.type });
      if (upload.error) throw upload.error;
      coverImageUrl = client.storage.from('forum-covers').getPublicUrl(path).data.publicUrl;
    }
    await createForumCategory(client, { title: form.get('title'), description: form.get('description'), coverImageUrl });
    categoryForm.reset();
    adminStatus.textContent = 'Category added.';
    await loadForum();
  } catch (error) {
    console.error(error);
    adminStatus.textContent = 'Unable to add category. Check your admin permission and try again.';
  }
});

setupAdminTools().catch(() => {});
loadForum().catch(renderLoadError);
