import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { listMyThreads, listThreadMessages, createThread } from '../data/messages.js';
import { searchProfiles } from '../data/profiles.js';
import { escapeHtml } from '../ui.js';

const client = getSupabaseClient();
const session = await getSession(client);
if (!session) { location.href = 'login.html?next=messages.html'; throw new Error('authentication required'); }
const list = document.getElementById('list');
const status = document.getElementById('status');
const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const userSearch = document.getElementById('userSearch');
const startMsg = document.getElementById('startMsg');
async function startChat() {
  const term = userSearch.value.trim().replace(/^@/, '');
  if (!term) { startMsg.textContent = 'Enter a username.'; return; }
  startMsg.textContent = 'Searching…';
  const matches = await searchProfiles(client, term, { limit: 2 });
  const target = matches.find((profile) => profile.id !== session.user.id);
  if (!target) { startMsg.textContent = 'User not found.'; return; }
  startBtn.disabled = true;
  try {
    const threadId = await createThread(client, target.id);
    location.href = `dm.html?id=${encodeURIComponent(threadId)}`;
  } catch (error) { startMsg.textContent = error.message || 'Unable to start chat.'; }
  finally { startBtn.disabled = false; }
}
startBtn?.addEventListener('click', startChat);
userSearch?.addEventListener('keydown', (event) => { if (event.key === 'Enter') startChat(); });

const renderInbox = async () => {
  const threads = await listMyThreads(client);
  status.textContent = threads.length ? '' : 'No conversations yet.';
  list.innerHTML = threads.map((thread) => `<div class="thread" data-id="${escapeHtml(thread.id)}"><div><strong>Conversation</strong><div class="preview">Thread ${escapeHtml(thread.id)}</div></div></div>`).join('');
  list.querySelectorAll('.thread').forEach((node) => node.addEventListener('click', async () => {
    const messages = await listThreadMessages(client, node.dataset.id);
    preview.innerHTML = messages.map((message) => `<div class="card"><strong>${message.author_id === session.user.id ? 'You' : 'Participant'}</strong><div>${escapeHtml(message.body)}</div></div>`).join('') || 'No messages yet.';
  }));
};
try { await renderInbox(); } catch (error) { status.textContent = 'Unable to load messages right now.'; console.error(error); }
