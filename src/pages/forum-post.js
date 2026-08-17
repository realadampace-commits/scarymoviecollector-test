import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { getForumPost, listForumReplies } from '../data/forums.js';
import { createForumReply } from '../data/forums.js';
import { escapeHtml } from '../ui.js';

const id = new URLSearchParams(location.search).get('id');
const client = getSupabaseClient();
const title = document.getElementById('pTitle');
const body = document.getElementById('pBody');
const meta = document.getElementById('pMeta');
const replyBox = document.getElementById('replyCompose');
const replyText = document.getElementById('rcText');
const replySend = document.getElementById('rcSend');
const replyMsg = document.getElementById('rcMsg');
const status = document.getElementById('rStatus');
const list = document.getElementById('rList');

if (!id) { location.href = 'forum.html'; throw new Error('missing post id'); }
const post = await getForumPost(client, id);
if (!post) { title.textContent = 'Post not found'; throw new Error('post not found'); }
title.textContent = post.title || '(untitled)';
body.textContent = post.body || '';
document.getElementById('pWhen').textContent = new Date(post.created_at).toLocaleString();
meta.innerHTML = `@${escapeHtml(post.author_id || 'user')} • <span>${escapeHtml(new Date(post.created_at).toLocaleString())}</span>`;

async function renderReplies() {
  const replies = await listForumReplies(client, id);
  status.textContent = replies.length ? '' : 'No replies yet.';
  list.innerHTML = replies.map((reply) => `<div class="reply"><div><div class="metaRow"><strong>@${escapeHtml(reply.author_id || 'user')}</strong><span class="muted">${escapeHtml(new Date(reply.created_at).toLocaleString())}</span></div><div class="rbody">${escapeHtml(reply.body)}</div></div></div>`).join('');
}

const session = await getSession(client);
if (session) {
  replyBox.style.display = '';
  replySend.addEventListener('click', async () => {
    replySend.disabled = true;
    try {
      await createForumReply(client, { postId: id, authorId: session.user.id, body: replyText.value });
      replyText.value = ''; replyMsg.textContent = 'Reply posted.'; await renderReplies();
    } catch (error) { replyMsg.textContent = error.message || 'Unable to post reply.'; }
    finally { replySend.disabled = false; }
  });
}
await renderReplies();
