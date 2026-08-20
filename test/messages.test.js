import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestTracker, getOtherParticipantId, listThreadMessages, sendMessage } from '../src/data/messages.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },
    limit(...args) { calls.push(['limit', ...args]); return this; },
    insert(...args) { calls.push(['insert', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); }
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

test('sendMessage trims body and sends explicit author identity', async () => {
  const fake = fakeClient({ data: { id: 'm1' }, error: null });
  await sendMessage(fake.client, { threadId: 't1', authorId: 'u1', body: ' hello ' });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'insert')[1], {
    thread_id: 't1', author_id: 'u1', body: 'hello'
  });
});
