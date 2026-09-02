import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequestTracker, deleteThreadForEveryone, getOtherParticipantId, hideThreadForUser, listMyThreads, listThreadMessages, sendMessage } from '../src/data/messages.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },
    limit(...args) { calls.push(['limit', ...args]); return this; },
    insert(...args) { calls.push(['insert', ...args]); return this; },
    upsert(...args) { calls.push(['upsert', ...args]); return Promise.resolve(result); },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); },
    then(resolve) { return Promise.resolve(result).then(resolve); }
  };
  return { client: { from(table) { calls.push(['from', table]); return builder; } }, calls };
}

test('createRequestTracker invalidates stale async render requests', () => {
  const tracker = createRequestTracker();
  const first = tracker.start();
  assert.equal(tracker.current(), first);
  const second = tracker.start();
  assert.equal(tracker.current(), second);
  assert.equal(tracker.isCurrent(first), false);
  assert.equal(tracker.isCurrent(second), true);
});

test('getOtherParticipantId returns the other member in a direct-message thread', () => {
  const thread = { dm_participants: [{ user_id: 'me' }, { user_id: 'admin' }] };
  assert.equal(getOtherParticipantId(thread, 'me'), 'admin');
  assert.equal(getOtherParticipantId(thread, 'unknown'), null);
});

test('listThreadMessages rejects missing thread ids', async () => {
  await assert.rejects(() => listThreadMessages({}, ''), /thread id is required/);
});

test('listMyThreads excludes conversations hidden by the current user', async () => {
  const client = { from(table) { return table === 'dm_threads'
    ? { select() { return this; }, order() { return Promise.resolve({ data: [{ id: 'visible' }, { id: 'hidden' }], error: null }); } }
    : { select() { return Promise.resolve({ data: [{ thread_id: 'hidden' }], error: null }); } };
  } };
  assert.deepEqual(await listMyThreads(client), [{ id: 'visible' }]);
});

test('thread deletion modes call separate protected database operations', async () => {
  const fake = fakeClient({ data: null, error: null });
  await hideThreadForUser(fake.client, { threadId: 't1', userId: 'u1' });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'upsert'), ['upsert', { thread_id: 't1', user_id: 'u1' }, { onConflict: 'thread_id,user_id' }]);
  const rpcCalls = [];
  const client = { async rpc(name, args) { rpcCalls.push([name, args]); return { data: true, error: null }; } };
  assert.equal(await deleteThreadForEveryone(client, 't1'), true);
  assert.deepEqual(rpcCalls, [['delete_dm_thread_for_all', { target_thread: 't1' }]]);
});

test('listThreadMessages fetches the latest page and returns it in chronological order', async () => {
  const latestFirst = [
    { id: 'm3', created_at: '2026-08-22T03:00:00Z' },
    { id: 'm2', created_at: '2026-08-22T02:00:00Z' }
  ];
  const fake = fakeClient({ data: latestFirst, error: null });

  const messages = await listThreadMessages(fake.client, 't1', { limit: 2 });

  assert.deepEqual(fake.calls.find((x) => x[0] === 'order'), ['order', 'created_at', { ascending: false }]);
  assert.deepEqual(messages.map((message) => message.id), ['m2', 'm3']);
});

test('sendMessage trims body and sends explicit author identity', async () => {
  const fake = fakeClient({ data: { id: 'm1' }, error: null });
  await sendMessage(fake.client, { threadId: 't1', authorId: 'u1', body: ' hello ' });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'insert')[1], {
    thread_id: 't1', author_id: 'u1', body: 'hello'
  });
});

test('sendMessage rejects when the database did not create a message', async () => {
  const fake = fakeClient({ data: null, error: null });

  await assert.rejects(
    () => sendMessage(fake.client, { threadId: 't1', authorId: 'u1', body: 'hello' }),
    /message was not sent/
  );
});

test('new-chat search has a visible associated label', () => {
  const html = readFileSync(resolve(import.meta.dirname, '../messages.html'), 'utf8');
  assert.match(html, /<label class="sr-only" for="userSearch">Username<\/label>/);
  assert.match(html, /id="userSearch"[^>]*role="combobox"[^>]*aria-controls="userSuggestions"[^>]*aria-expanded="false"/);
  assert.match(html, /id="userSuggestions"[^>]*role="listbox"/);
});

test('message avatars render profile photos and frames when available', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /profileAvatarMarkup/);
  assert.match(script, /mine \? myProfile : thread\.profile/);
});

test('username chat creation reuses an already-loaded conversation', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /thread\.otherUserId === target\.id/);
  assert.match(script, /existing\?\.id \|\| await createThread/);
});

test('new-chat search offers debounced keyboard-accessible suggestions while typing', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /userSearch\.addEventListener\('input'/);
  assert.match(script, /setTimeout\(updateSuggestions, 180\)/);
  assert.match(script, /role="option"/);
  assert.match(script, /event\.key === 'ArrowDown'/);
  assert.match(script, /profile\.username\?\.toLowerCase\(\) === term\.toLowerCase\(\)/);
});

test('messages provide delete-for-me and delete-for-everyone controls', () => {
  const html = readFileSync(resolve(import.meta.dirname, '../messages.html'), 'utf8');
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(html, /id="deleteForMe"[^>]*>Delete for me/);
  assert.match(html, /id="deleteForAll"[^>]*>Delete for everyone/);
  assert.match(script, /hideThreadForUser/);
  assert.match(script, /deleteThreadForEveryone/);
  assert.match(script, /The other person will still have it/);
  assert.match(script, /All messages will be permanently removed/);
});

test('profile message links can open the canonical conversation directly', () => {
  const profile = readFileSync(resolve(import.meta.dirname, '../user.html'), 'utf8');
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(profile, /id="messageLink"[^>]*>Message<\/a>/);
  assert.match(profile, /messages\.html\?u=/);
  assert.match(script, /new URLSearchParams\(location\.search\)\.get\('u'\)/);
});

test('database migration enforces one canonical thread per user pair', () => {
  const migration = readFileSync(resolve(import.meta.dirname, '../supabase/migrations/202609020003_canonical_dm_threads_and_deletion.sql'), 'utf8');
  assert.match(migration, /primary key \(user_low, user_high\)/);
  assert.match(migration, /on conflict \(user_low, user_high\) do nothing/);
  assert.match(migration, /update public\.dm_messages[\s\S]*set thread_id = pairs\.canonical_id/);
  assert.match(migration, /delete_dm_thread_for_all/);
  assert.match(migration, /dm_thread_hidden/);
});

test('new-chat search exposes its in-progress state and restores the action label', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /startBtn\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(script, /startBtn\.textContent = 'Searching…'/);
  assert.match(script, /startBtn\.removeAttribute\('aria-busy'\)/);
  assert.match(script, /startBtn\.textContent = 'Open'/);
});

test('message composer explains its Enter and Shift+Enter shortcuts', () => {
  const html = readFileSync(resolve(import.meta.dirname, '../messages.html'), 'utf8');
  assert.match(html, /aria-describedby="composerHelp"/);
  assert.match(html, /Choose a conversation to enable messaging\. Enter to send · Shift\+Enter for a new line/);
});

test('message navigation restores focus after switching mobile views', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /text\.focus\(\)/);
  assert.match(script, /function returnToInbox\(\)/);
  assert.match(script, /shell\.classList\.remove\('show-thread'\)/);
  assert.match(script, /CSS\.escape\(activeThread\?\.id/);
});

test('message navigation supports Escape to close the active conversation', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /shell\.classList\.contains\('show-thread'\)/);
  assert.match(script, /event\.preventDefault\(\);\s*returnToInbox\(\);/);
});

test('message loading errors provide an actionable retry control', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /Check your connection, then retry/);
  assert.match(script, /class=\"retry-messages\" type=\"button\"/);
  assert.match(script, /preview\.addEventListener\('click'/);
  assert.match(script, /selectThread\(activeThread\.id, \{ refreshInbox: false \}\)/);
});

test('conversation inbox loading errors provide an actionable retry control', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /class=\"retry-inbox\" type=\"button\"/);
  assert.match(script, /status\.addEventListener\('click'/);
  assert.match(script, /if \(event\.target\.closest\('\.retry-inbox'\)\) renderInbox\(\)/);
});
