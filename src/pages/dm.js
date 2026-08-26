import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { listThreadMessages, sendMessage } from '../data/messages.js';
import { escapeHtml } from '../ui.js';

const threadId = new URLSearchParams(location.search).get('id');
const client = getSupabaseClient();
const session = await getSession(client);
if (!threadId || !/^[0-9a-f-]{8,}$/i.test(threadId)) { location.href = 'messages.html'; throw new Error('invalid thread id'); }
if (!session) { location.href = `login.html?next=${encodeURIComponent(`dm.html?id=${threadId}`)}`; throw new Error('authentication required'); }
const head = document.getElementById('head');
const list = document.getElementById('list');
const text = document.getElementById('text');
const send = document.getElementById('send');
const status = document.getElementById('status');
async function render() {
  list.setAttribute('aria-busy', 'true');
  try {
    const messages = await listThreadMessages(client, threadId);
    list.innerHTML = messages.length
      ? messages.map((message) => `<div class="row ${message.author_id === session.user.id ? 'mine' : ''}"><div class="bubble">${escapeHtml(message.body)}</div><div class="meta">${message.author_id === session.user.id ? 'You' : 'Participant'}</div></div>`).join('')
      : '<p class="muted empty-state">No messages yet. Send a message to start the conversation.</p>';
    list.scrollTop = list.scrollHeight;
  } catch (error) {
    console.error(error);
    list.innerHTML = '<p class="muted">Unable to load messages right now. <button class="retry-messages" type="button">Retry loading messages</button></p>';
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}
head.textContent = `Conversation ${threadId}`;
let sending = false;
async function submit() {
  if (sending) return;
  const body = text.value.trim();
  if (!body) return;
  sending = true;
  send.disabled = true;
  status.textContent = 'Sending…';
  try { await sendMessage(client, { threadId, authorId: session.user.id, body }); text.value = ''; status.textContent = 'Sent.'; await render(); }
  catch (error) { status.textContent = error.message || 'Unable to send message.'; }
  finally { sending = false; send.disabled = false; }
}
send.addEventListener('click', submit);
list.addEventListener('click', (event) => {
  if (event.target.closest('.retry-messages')) render();
});
text.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } });
await render();

const channel = client.channel(`dm-thread-${threadId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` }, async () => {
    try { await render(); } catch (error) { console.error(error); }
  })
  .subscribe();
let cleanedUp = false;
async function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  await client.removeChannel(channel);
}
window.addEventListener('pagehide', cleanup, { once: true });
window.addEventListener('beforeunload', cleanup, { once: true });
