import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { listThreadMessages, sendMessage } from '../data/messages.js';
import { escapeHtml } from '../ui.js';

const threadId = new URLSearchParams(location.search).get('id');
const client = getSupabaseClient();
const session = await getSession(client);
if (!threadId) { location.href = 'messages.html'; throw new Error('missing thread id'); }
if (!session) { location.href = `login.html?next=${encodeURIComponent(`dm.html?id=${threadId}`)}`; throw new Error('authentication required'); }
const head = document.getElementById('head');
const list = document.getElementById('list');
const text = document.getElementById('text');
const send = document.getElementById('send');
const status = document.getElementById('status');
async function render() {
  const messages = await listThreadMessages(client, threadId);
  list.innerHTML = messages.map((message) => `<div class="row ${message.author_id === session.user.id ? 'mine' : ''}"><div class="bubble">${escapeHtml(message.body)}</div><div class="meta">${message.author_id === session.user.id ? 'You' : 'Participant'}</div></div>`).join('');
  list.scrollTop = list.scrollHeight;
}
head.textContent = `Conversation ${threadId}`;
async function submit() {
  const body = text.value.trim();
  if (!body) return;
  send.disabled = true;
  try { await sendMessage(client, { threadId, authorId: session.user.id, body }); text.value = ''; status.textContent = 'Sent.'; await render(); }
  catch (error) { status.textContent = error.message || 'Unable to send message.'; }
  finally { send.disabled = false; }
}
send.addEventListener('click', submit);
text.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } });
try { await render(); } catch (error) { status.textContent = 'Unable to load messages.'; console.error(error); }
