import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { createRequestTracker, createThread, deleteThreadForEveryone, getOtherParticipantId, hideThreadForUser, listMyThreads, listThreadMessages, sendMessage } from '../data/messages.js';
import { getProfile, searchProfiles } from '../data/profiles.js';
import { escapeHtml, profileAvatarMarkup } from '../ui.js';

const client = getSupabaseClient();
const session = await getSession(client);
if (!session) { location.href = 'login.html?next=messages.html'; throw new Error('authentication required'); }
const myProfile = await getProfile(client, session.user.id).catch(() => null);

const shell = document.getElementById('messagesShell');
const list = document.getElementById('list');
const status = document.getElementById('status');
const preview = document.getElementById('preview');
const head = document.getElementById('head');
const subhead = document.getElementById('subhead');
let headAvatar = document.getElementById('headAvatar');
const text = document.getElementById('text');
const send = document.getElementById('send');
const composeStatus = document.getElementById('composeStatus');
const userSearch = document.getElementById('userSearch');
const startBtn = document.getElementById('startBtn');
const startMsg = document.getElementById('startMsg');
const suggestions = document.getElementById('userSuggestions');
const threadDeleteActions = document.getElementById('threadDeleteActions');
const deleteForMe = document.getElementById('deleteForMe');
const deleteForAll = document.getElementById('deleteForAll');
let activeThread = null;
let threadCards = [];
const selectionRequests = createRequestTracker();
const suggestionRequests = createRequestTracker();
let suggestionTimer = null;
let suggestedProfiles = [];
let selectedProfile = null;

const avatarMarkup = (profile, name, className = 'avatar') => profileAvatarMarkup(profile, { name, className });
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
    otherUserId,
    profile,
    name: profile?.username ? `@${profile.username}` : 'Conversation',
    preview: lastMessage?.body || 'No messages yet',
    updatedAt: lastMessage?.created_at || thread.created_at
  };
}

function renderThreadList() {
  status.textContent = threadCards.length ? '' : 'No conversations yet. Start one above.';
  list.innerHTML = threadCards.map((thread) => `<button class="thread ${thread.id === activeThread?.id ? 'active' : ''}" type="button" data-id="${escapeHtml(thread.id)}">
    ${avatarMarkup(thread.profile, thread.profile?.username)}
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
  const wrapper = document.createElement('template');
  wrapper.innerHTML = avatarMarkup(thread.profile, thread.profile?.username, 'avatar');
  const nextAvatar = wrapper.content.firstElementChild;
  nextAvatar.id = 'headAvatar';
  headAvatar.replaceWith(nextAvatar);
  headAvatar = document.getElementById('headAvatar');
  text.disabled = false;
  send.disabled = false;
  text.focus();
  composeStatus.textContent = '';
  threadDeleteActions.hidden = false;
  renderThreadList();
  preview.innerHTML = '<div class="welcome"><p>Loading messages…</p></div>';
  try {
    const messages = await listThreadMessages(client, id);
    if (!selectionRequests.isCurrent(request) || activeThread?.id !== id) return;
    preview.innerHTML = messages.map((message) => {
      const mine = message.author_id === session.user.id;
      const label = mine ? 'You' : thread.name;
      return `<div class="message-row ${mine ? 'mine' : ''}">${avatarMarkup(mine ? myProfile : thread.profile, mine ? 'You' : thread.profile?.username)}<div><div class="bubble">${escapeHtml(message.body)}</div><span class="message-meta">${escapeHtml(label)} · ${escapeHtml(timeLabel(message.created_at))}</span></div></div>`;
    }).join('') || '<div class="welcome"><div class="avatar">✦</div><h2>Say hello</h2><p>This is the beginning of your conversation with ' + escapeHtml(thread.name) + '.</p></div>';
    preview.scrollTop = preview.scrollHeight;
  } catch (error) {
    if (!selectionRequests.isCurrent(request) || activeThread?.id !== id) return;
    preview.innerHTML = '<div class="welcome"><h2>Unable to load messages</h2><p>Check your connection, then retry.</p><button class="retry-messages" type="button">Retry loading messages</button></div>';
    console.error(error);
  }
  if (refreshInbox) renderThreadList();
}

function closeSuggestions() {
  suggestions.hidden = true;
  suggestions.replaceChildren();
  userSearch.setAttribute('aria-expanded', 'false');
}

function renderSuggestions(profiles) {
  suggestedProfiles = profiles.filter((profile) => profile.id !== session.user.id);
  if (!suggestedProfiles.length) { closeSuggestions(); return; }
  suggestions.innerHTML = suggestedProfiles.map((profile, index) => `<button class="suggestion" id="user-suggestion-${index}" type="button" role="option" data-id="${escapeHtml(profile.id)}" aria-selected="false"><span>@${escapeHtml(profile.username)}</span><span class="suggestion-role">${escapeHtml(profile.role || 'member')}</span></button>`).join('');
  suggestions.hidden = false;
  userSearch.setAttribute('aria-expanded', 'true');
}

async function updateSuggestions() {
  const term = userSearch.value.trim().replace(/^@/, '');
  selectedProfile = null;
  const request = suggestionRequests.start();
  if (!term) { closeSuggestions(); return; }
  try {
    const matches = await searchProfiles(client, term, { limit: 8 });
    if (suggestionRequests.isCurrent(request)) renderSuggestions(matches);
  } catch (error) {
    if (suggestionRequests.isCurrent(request)) closeSuggestions();
    console.error(error);
  }
}

async function startChat(chosenProfile = selectedProfile) {
  const term = userSearch.value.trim().replace(/^@/, '');
  if (!term) { startMsg.textContent = 'Enter a username to start a chat.'; return; }
  startMsg.textContent = 'Searching…';
  startBtn.disabled = true;
  startBtn.setAttribute('aria-busy', 'true');
  startBtn.textContent = 'Searching…';
  try {
    const matches = chosenProfile ? [chosenProfile] : await searchProfiles(client, term, { limit: 8 });
    const target = chosenProfile || matches.find((profile) => profile.id !== session.user.id && profile.username?.toLowerCase() === term.toLowerCase());
    if (!target) { startMsg.textContent = 'No matching member found.'; return; }
    const existing = threadCards.find((thread) => thread.otherUserId === target.id);
    const threadId = existing?.id || await createThread(client, target.id);
    userSearch.value = '';
    selectedProfile = null;
    closeSuggestions();
    startMsg.textContent = '';
    await renderInbox(threadId);
  } catch (error) {
    startMsg.textContent = error.message || 'Unable to start chat.';
  } finally {
    startBtn.disabled = false;
    startBtn.removeAttribute('aria-busy');
    startBtn.textContent = 'Open';
  }
}

async function removeActiveThread(mode) {
  const thread = activeThread;
  if (!thread) return;
  const forEveryone = mode === 'all';
  const warning = forEveryone
    ? `Delete the entire conversation with ${thread.name} for both people? All messages will be permanently removed.`
    : `Remove the conversation with ${thread.name} from your messages? The other person will still have it.`;
  if (!confirm(warning)) return;
  deleteForMe.disabled = true;
  deleteForAll.disabled = true;
  composeStatus.textContent = forEveryone ? 'Deleting conversation for everyone…' : 'Removing conversation…';
  try {
    if (forEveryone) await deleteThreadForEveryone(client, thread.id);
    else await hideThreadForUser(client, { threadId: thread.id, userId: session.user.id });
    selectionRequests.start();
    activeThread = null;
    shell.classList.remove('show-thread');
    threadDeleteActions.hidden = true;
    text.disabled = true;
    send.disabled = true;
    head.textContent = 'Choose a conversation';
    subhead.textContent = 'Select a chat or start a new one.';
    preview.innerHTML = '<div class="welcome"><div class="avatar">✦</div><h2>Your messages</h2><p>Choose a conversation on the left to read and reply.</p></div>';
    await renderInbox();
  } catch (error) {
    console.error(error);
    composeStatus.textContent = 'Unable to delete this conversation. Try again.';
  } finally {
    deleteForMe.disabled = false;
    deleteForAll.disabled = false;
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
userSearch.addEventListener('input', () => {
  selectedProfile = null;
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(updateSuggestions, 180);
});
userSearch.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' && !suggestions.hidden) { event.preventDefault(); suggestions.querySelector('.suggestion')?.focus(); }
  if (event.key === 'Escape') closeSuggestions();
});
suggestions.addEventListener('click', (event) => {
  const option = event.target.closest('.suggestion');
  if (!option) return;
  selectedProfile = suggestedProfiles.find((profile) => profile.id === option.dataset.id) || null;
  if (!selectedProfile) return;
  userSearch.value = `@${selectedProfile.username}`;
  closeSuggestions();
  startChat(selectedProfile);
});
suggestions.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Escape') { closeSuggestions(); userSearch.focus(); return; }
  const options = [...suggestions.querySelectorAll('.suggestion')];
  const current = options.indexOf(document.activeElement);
  const next = event.key === 'ArrowDown' ? (current + 1) % options.length : (current - 1 + options.length) % options.length;
  options[next]?.focus();
});
deleteForMe.addEventListener('click', () => removeActiveThread('me'));
deleteForAll.addEventListener('click', () => removeActiveThread('all'));
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

const threadFromUrl = new URLSearchParams(location.search).get('thread');
await renderInbox(threadFromUrl);
const profileFromUrl = new URLSearchParams(location.search).get('u');
if (profileFromUrl) {
  userSearch.value = `@${profileFromUrl.replace(/^@/, '')}`;
  await startChat();
}
