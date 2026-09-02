import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { deleteForumPost, getForumPost, listForumReplies, getForumPostLikeState, toggleForumPostLike } from '../data/forums.js';
import { createForumReply } from '../data/forums.js';
import { escapeHtml, profileAvatarMarkup } from '../ui.js';
import { getProfile } from '../data/profiles.js';
import { formatShortDate } from '../utils/date.js';

const forumDateOptions = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' };
const when = (value) => formatShortDate(value, forumDateOptions);

const id = new URLSearchParams(location.search).get('id');
const client = getSupabaseClient();
const title = document.getElementById('pTitle');
const body = document.getElementById('pBody');
const meta = document.getElementById('pMeta');
const replyBox = document.getElementById('replyCompose');
const replyText = document.getElementById('rcText');
const replySend = document.getElementById('rcSend');
const replyMsg = document.getElementById('rcMsg');
replyMsg.setAttribute('role', 'status');
replyMsg.setAttribute('aria-live', 'polite');
const status = document.getElementById('rStatus');
const list = document.getElementById('rList');

if (!id) { location.href = 'forum.html'; throw new Error('missing post id'); }
const post = await getForumPost(client, id);
if (!post) { title.textContent = 'Post not found'; throw new Error('post not found'); }
title.textContent = post.title || '(untitled)';
body.textContent = post.body || '';
document.getElementById('pWhen').textContent = when(post.created_at);
const author = await getProfile(client, post.author_id).catch(() => null);
const authorName = author?.username || 'Community member';
const avatarTemplate = document.createElement('template');
avatarTemplate.innerHTML = profileAvatarMarkup(author, { name: authorName, className: 'ava', label: `${authorName}'s profile picture` });
const avatar = avatarTemplate.content.firstElementChild;
avatar.id = 'pAvatar';
document.getElementById('pAvatar').replaceWith(avatar);
meta.innerHTML = `<strong>${escapeHtml(authorName)}</strong> · <span>${escapeHtml(when(post.created_at))}</span>`;

async function renderReplies() {
  status.textContent = 'Loading replies…';
  list.setAttribute('aria-busy', 'true');
  const replies = await listForumReplies(client, id);
  const authorIds = [...new Set(replies.map((reply) => reply.author_id).filter(Boolean))];
  const { data: profiles } = authorIds.length ? await client.from('profiles').select('id,username,avatar_url,frame_url,frame_scale,frame_offset_x,frame_offset_y').in('id', authorIds) : { data: [] };
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  status.textContent = replies.length ? '' : 'No comments yet.';
  document.getElementById('commentCount').textContent = `${replies.length} comment${replies.length === 1 ? '' : 's'}`;
  list.innerHTML = replies.map((reply) => { const profile = profileMap.get(reply.author_id); const name = profile?.username || 'Community member'; const avatar = profileAvatarMarkup(profile, { name, className: 'reply-ava' }); return `<div class="reply">${avatar}<div><div class="metaRow"><strong>${escapeHtml(name)}</strong><span class="muted">${escapeHtml(when(reply.created_at))}</span></div><div class="rbody">${escapeHtml(reply.body)}</div></div></div>`; }).join('');
  list.removeAttribute('aria-busy');
}

function renderRepliesError(error) {
  console.error(error);
  list.removeAttribute('aria-busy');
  status.innerHTML = 'Unable to load replies right now. <button class="retry-replies" type="button">Retry loading replies</button>';
}

status.addEventListener('click', (event) => {
  if (event.target.closest('.retry-replies')) renderReplies().catch(renderRepliesError);
});

const session = await getSession(client);
const viewerProfile = session?.user?.id ? await getProfile(client, session.user.id).catch(() => null) : null;
const canDeletePost = Boolean(session?.user?.id && (post.author_id === session.user.id || ['moderator', 'owner'].includes(viewerProfile?.role)));
const likeState = await getForumPostLikeState(client, id, session?.user?.id);
const actions = document.getElementById('postActions');
actions.innerHTML = `<div class="post-stats"><span id="likeCount">${likeState.count ? `♡ ${likeState.count}` : 'Be the first to like this'}</span><span id="commentCount">Loading comments…</span></div><div class="post-actions${canDeletePost ? ' can-delete' : ''}"><button id="likeBtn" class="btn-action${likeState.liked ? ' liked' : ''}" type="button">${likeState.liked ? '♥ Liked' : '♡ Like'}</button><button id="commentBtn" class="btn-action" type="button">💬 Comment</button><button id="shareBtn" class="btn-action" type="button">↗ Share</button>${canDeletePost ? '<button id="deletePostBtn" class="btn-action danger-action" type="button">Delete post</button>' : ''}</div><p id="postDeleteStatus" class="muted" role="status" aria-live="polite"></p>`;
const likeBtn = document.getElementById('likeBtn');
const likeCount = document.getElementById('likeCount');
const commentBtn = document.getElementById('commentBtn');
const shareBtn = document.getElementById('shareBtn');
likeBtn.addEventListener('click', async () => { if (!session) { likeBtn.textContent = 'Sign in to like'; return; } likeBtn.disabled = true; try { const next = await toggleForumPostLike(client, { postId:id, userId:session.user.id, liked:likeBtn.classList.contains('liked') }); likeBtn.classList.toggle('liked', next.liked); likeBtn.textContent = next.liked ? '♥ Liked' : '♡ Like'; likeCount.textContent = next.count ? `♡ ${next.count}` : 'Be the first to like this'; } finally { likeBtn.disabled = false; } });
commentBtn.addEventListener('click', () => { replyBox.style.display = ''; replyText.focus(); });
shareBtn.addEventListener('click', async () => {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(location.href);
    shareBtn.textContent = '✓ Copied';
  } catch {
    shareBtn.textContent = 'Unable to copy link';
  }
});
document.getElementById('deletePostBtn')?.addEventListener('click', async (event) => {
  if (!confirm('Delete this forum post and all of its replies? This cannot be undone.')) return;
  const button = event.currentTarget;
  const deleteStatus = document.getElementById('postDeleteStatus');
  button.disabled = true;
  button.textContent = 'Deleting…';
  deleteStatus.textContent = 'Deleting post…';
  try {
    await deleteForumPost(client, { postId: id, userId: session.user.id });
    deleteStatus.textContent = 'Post deleted.';
    location.href = 'forum.html';
  } catch (error) {
    console.error(error);
    deleteStatus.textContent = 'Unable to delete this post. Refresh and try again.';
    button.disabled = false;
    button.textContent = 'Delete post';
  }
});
if (session) {
  replyBox.style.display = '';
  replySend.addEventListener('click', async () => {
    const replyBody = replyText.value.trim();
    if (!replyBody) {
      replyMsg.textContent = 'Write a reply before posting.';
      replyText.focus();
      return;
    }
    replySend.disabled = true;
    replySend.textContent = 'Posting…';
    replySend.setAttribute('aria-busy', 'true');
    try {
      await createForumReply(client, { postId: id, authorId: session.user.id, body: replyBody });
      replyText.value = ''; replyMsg.textContent = 'Reply posted.'; await renderReplies().catch(renderRepliesError);
    } catch (error) { replyMsg.textContent = error.message || 'Unable to post reply.'; }
    finally { replySend.disabled = false; replySend.textContent = 'Post Reply'; replySend.removeAttribute('aria-busy'); }
  });
}
renderReplies().catch(renderRepliesError);
