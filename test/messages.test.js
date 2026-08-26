import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequestTracker, getOtherParticipantId, listThreadMessages, sendMessage } from '../src/data/messages.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },
    limit(...args) { calls.push(['limit', ...args]); return this; },
    insert(...args) { calls.push(['insert', ...args]); return this; },
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
  assert.match(html, /<input id="userSearch" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Message @username" required minlength="1"\/>/);
});

test('message avatars render profile photos and frames when available', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /avatar-media/);
  assert.match(script, /avatar-frame/);
  assert.match(script, /profile\?\.avatar_url/);
  assert.match(script, /profile\?\.frame_url/);
});

test('username chat creation reuses an already-loaded conversation', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /thread\.otherUserId === target\.id/);
  assert.match(script, /existing\?\.id \|\| await createThread/);
});

test('new-chat search exposes its in-progress state and restores the action label', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/messages.js'), 'utf8');
  assert.match(script, /startBtn\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(script, /startBtn\.textContent = 'Searching…'/);
  assert.match(script, /startBtn\.removeAttribute\('aria-busy'\)/);
  assert.match(script, /startBtn\.textContent = 'Send'/);
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
