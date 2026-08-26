import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { getForumPost, listForumReplies } from '../data/forums.js';
import { createForumReply } from '../data/forums.js';
import { escapeHtml } from '../ui.js';
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
meta.innerHTML = `@${escapeHtml(post.author_id || 'user')} • <span>${escapeHtml(when(post.created_at))}</span>`;

async function renderReplies() {
  status.textContent = 'Loading replies…';
  list.setAttribute('aria-busy', 'true');
  const replies = await listForumReplies(client, id);
  status.textContent = replies.length ? '' : 'No replies yet.';
  list.innerHTML = replies.map((reply) => `<div class="reply"><div><div class="metaRow"><strong>@${escapeHtml(reply.author_id || 'user')}</strong><span class="muted">${escapeHtml(when(reply.created_at))}</span></div><div class="rbody">${escapeHtml(reply.body)}</div></div></div>`).join('');
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
