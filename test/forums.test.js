import test from 'node:test';
import assert from 'node:assert/strict';
import { createForumReply, listCategoryPosts, listForumPosts } from '../src/data/forums.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

test('listCategoryPosts includes post body for feed-card previews', async () => {
  const fake = fakeClient({ data: [], error: null });
  await listCategoryPosts(fake.client, 'category-1');
  assert.match(fake.calls.find((x) => x[0] === 'select')[1], /body/);
  assert.deepEqual(fake.calls.find((x) => x[0] === 'limit'), ['limit', 100]);
});

test('listCategoryPosts clamps requested limits', async () => {
  const fake = fakeClient({ data: [], error: null });
  await listCategoryPosts(fake.client, 'category-1', { limit: 1000 });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'limit'), ['limit', 100]);
});

test('listForumPosts rejects a non-string category id', async () => {
  await assert.rejects(() => listForumPosts({}, { categoryId: 42 }), /category id must be a string/);
});

test('createForumReply rejects empty body', async () => {
  await assert.rejects(() => createForumReply({}, { postId: 'p', authorId: 'u', body: ' ' }), /required/);
});

test('forum feed errors offer an in-place retry', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/forum.js'), 'utf8');
  assert.match(script, /Retry loading the forum/);
  assert.match(script, /status\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(script, /status\.setAttribute\('aria-busy', 'false'\)/);
  assert.match(script, /posts\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(script, /posts\.setAttribute\('aria-busy', 'false'\)/);
  assert.match(script, /Loading community posts/);
  assert.match(script, /posts\.addEventListener\('click'/);
  assert.match(script, /loadForum\(\)\.catch\(renderLoadError\)/);
});

test('forum category status is announced as one complete status message', () => {
  const page = readFileSync(resolve(import.meta.dirname, '../forum.html'), 'utf8');
  assert.match(page, /id="status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
});
