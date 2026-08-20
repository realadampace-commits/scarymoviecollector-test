import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { createRequestTracker, createThread, getOtherParticipantId, listMyThreads, listThreadMessages, sendMessage } from '../data/messages.js';
import { getProfile, searchProfiles } from '../data/profiles.js';
import { escapeHtml } from '../ui.js';

const client = getSupabaseClient();
const session = await getSession(client);
if (!session) { location.href = 'login.html?next=messages.html'; throw new Error('authentication required'); }

const shell = document.getElementById('messagesShell');
const list = document.getElementById('list');
const status = document.getElementById('status');
const preview = document.getElementById('preview');
const head = document.getElementById('head');
const subhead = document.getElementById('subhead');
const headAvatar = document.getElementById('headAvatar');
const text = document.getElementById('text');
const send = document.getElementById('send');
const composeStatus = document.getElementById('composeStatus');
const userSearch = document.getElementById('userSearch');
const startBtn = document.getElementById('startBtn');
const startMsg = document.getElementById('startMsg');
let activeThread = null;
let threadCards = [];
const selectionRequests = createRequestTracker();

const initials = (name) => String(name || '?').replace(/^@/, '').slice(0, 1).toUpperCase();
const timeLabel = (date) => {
  const value = new Date(date).getTime();
  if (!Number.isFinite(value)) return '';
  const diff = Date.now() - value;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
};

async function enrichThread(thread) {
  const otherUserId = getOtherParticipantId(thread, session.user.id);
  const [profile, messages] = await Promise.all([
    otherUserId ? getProfile(client, otherUserId) : Promise.resolve(null),
    listThreadMessages(client, thread.id)
  ]);
  const lastMessage = messages.at(-1);
  return {
    ...thread,
    profile,
    name: profile?.username ? `@${profile.username}` : 'Conversation',
    preview: lastMessage?.body || 'No messages yet',
    updatedAt: lastMessage?.created_at || thread.created_at
  };
}

function renderThreadList() {
  status.textContent = threadCards.length ? '' : 'No conversations yet. Start one above.';
  list.innerHTML = threadCards.map((thread) => `<button class="thread ${thread.id === activeThread?.id ? 'active' : ''}" type="button" data-id="${escapeHtml(thread.id)}">
    <span class="avatar">${escapeHtml(initials(thread.profile?.username))}</span>
    <span class="thread-copy"><span class="thread-name"><span>${escapeHtml(thread.name)}</span><span class="thread-time">${escapeHtml(timeLabel(thread.updatedAt))}</span></span><span class="thread-preview">${escapeHtml(thread.preview)}</span></span>
  </button>`).join('');
  list.querySelectorAll('.thread').forEach((node) => node.addEventListener('click', () => selectThread(node.dataset.id)));
}

async function renderInbox(selectId = null) {
  status.textContent = 'Loading conversations…';
  list.innerHTML = '';
  try {
    const threads = await listMyThreads(client);
    threadCards = await Promise.all(threads.map(enrichThread));
    renderThreadList();
    if (selectId && threadCards.some((thread) => thread.id === selectId)) await selectThread(selectId, { refreshInbox: false });
  } catch (error) {
    threadCards = [];
    status.innerHTML = 'Unable to load conversations right now. <button class="retry-inbox" type="button">Retry loading conversations</button>';
    console.error(error);
  }
}

async function selectThread(id, { refreshInbox = true } = {}) {
  const thread = threadCards.find((candidate) => candidate.id === id);
  if (!thread) return;
  const request = selectionRequests.start();
  activeThread = thread;
  shell.classList.add('show-thread');
  head.textContent = thread.name;
  subhead.textContent = 'Messages are private to conversation participants.';
  headAvatar.textContent = initials(thread.profile?.username);
  text.disabled = false;
  send.disabled = false;
  text.focus();
  composeStatus.textContent = '';
  renderThreadList();
  preview.innerHTML = '<div class="welcome"><p>Loading messages…</p></div>';
  try {
    const messages = await listThreadMessages(client, id);
    if (!selectionRequests.isCurrent(request) || activeThread?.id !== id) return;
    preview.innerHTML = messages.map((message) => {
      const mine = message.author_id === session.user.id;
      const label = mine ? 'You' : thread.name;
      return `<div class="message-row ${mine ? 'mine' : ''}"><span class="avatar" aria-hidden="true">${escapeHtml(initials(mine ? 'You' : thread.profile?.username))}</span><div><div class="bubble">${escapeHtml(message.body)}</div><span class="message-meta">${escapeHtml(label)} · ${escapeHtml(timeLabel(message.created_at))}</span></div></div>`;
    }).join('') || '<div class="welcome"><div class="avatar">✦</div><h2>Say hello</h2><p>This is the beginning of your conversation with ' + escapeHtml(thread.name) + '.</p></div>';
    preview.scrollTop = preview.scrollHeight;
  } catch (error) {
    if (!selectionRequests.isCurrent(request) || activeThread?.id !== id) return;
    preview.innerHTML = '<div class="welcome"><h2>Unable to load messages</h2><p>Check your connection, then retry.</p><button class="retry-messages" type="button">Retry loading messages</button></div>';
    console.error(error);
  }
  if (refreshInbox) renderThreadList();
}

async function startChat() {
  const term = userSearch.value.trim().replace(/^@/, '');
  if (!term) { startMsg.textContent = 'Enter a username to start a chat.'; return; }
  startMsg.textContent = 'Searching…';
  startBtn.disabled = true;
  startBtn.setAttribute('aria-busy', 'true');
  startBtn.textContent = 'Searching…';
  try {
    const matches = await searchProfiles(client, term, { limit: 8 });
    const target = matches.find((profile) => profile.id !== session.user.id);
    if (!target) { startMsg.textContent = 'No matching member found.'; return; }
    const threadId = await createThread(client, target.id);
    userSearch.value = '';
    startMsg.textContent = '';
    await renderInbox(threadId);
  } catch (error) {
    startMsg.textContent = error.message || 'Unable to start chat.';
  } finally {
    startBtn.disabled = false;
    startBtn.removeAttribute('aria-busy');
    startBtn.textContent = 'Send';
  }
}

async function submitMessage() {
  const body = text.value.trim();
  const sendingThread = activeThread;
  if (!sendingThread || !body) return;
  const request = selectionRequests.current();
  send.disabled = true;
  composeStatus.textContent = 'Sending…';
  try {
    await sendMessage(client, { threadId: sendingThread.id, authorId: session.user.id, body });
    if (!selectionRequests.isCurrent(request) || activeThread?.id !== sendingThread.id) {
      await renderInbox();
      return;
    }
    text.value = '';
    composeStatus.textContent = '';
    await renderInbox(sendingThread.id);
  } catch (error) {
    if (!selectionRequests.isCurrent(request) || activeThread?.id !== sendingThread.id) return;
    composeStatus.textContent = error.message || 'Unable to send message.';
  } finally {
    if (selectionRequests.isCurrent(request) && activeThread?.id === sendingThread.id) send.disabled = false;
  }
}

document.getElementById('startForm').addEventListener('submit', (event) => { event.preventDefault(); startChat(); });
document.getElementById('composer').addEventListener('submit', (event) => { event.preventDefault(); submitMessage(); });
document.getElementById('focusStart').addEventListener('click', () => userSearch.focus());
function returnToInbox() {
  shell.classList.remove('show-thread');
  list.querySelector(`[data-id="${CSS.escape(activeThread?.id || '')}"]`)?.focus();
}

document.getElementById('backToInbox').addEventListener('click', returnToInbox);
status.addEventListener('click', (event) => {
  if (event.target.closest('.retry-inbox')) renderInbox();
});
preview.addEventListener('click', (event) => {
  if (event.target.closest('.retry-messages') && activeThread) selectThread(activeThread.id, { refreshInbox: false });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && shell.classList.contains('show-thread')) {
    event.preventDefault();
    returnToInbox();
  }
});
text.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(); } });

await renderInbox();
