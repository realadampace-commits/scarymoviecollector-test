import test from 'node:test';
import assert from 'node:assert/strict';
import { createForumReply, listForumPosts } from '../src/data/forums.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },
    limit(...args) { calls.push(['limit', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    insert(...args) { calls.push(['insert', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); },
    then(resolve) { return Promise.resolve(result).then(resolve); }
  };
  return { client: { from(table) { calls.push(['from', table]); return builder; } }, calls };
}

test('listForumPosts clamps limits', async () => {
  const fake = fakeClient({ data: [], error: null });
  await listForumPosts(fake.client, { limit: 1000 });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'limit'), ['limit', 100]);
});

test('createForumReply rejects empty body', async () => {
  await assert.rejects(() => createForumReply({}, { postId: 'p', authorId: 'u', body: ' ' }), /required/);
});
