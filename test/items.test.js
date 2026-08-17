import test from 'node:test';
import assert from 'node:assert/strict';
import { getItem, listRecentItems } from '../src/data/items.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(fields) { calls.push(['select', fields]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },
    limit(...args) { calls.push(['limit', ...args]); return Promise.resolve(result); },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); }
  };
  return { client: { from(table) { calls.push(['from', table]); return builder; } }, calls };
}

test('listRecentItems clamps the requested limit', async () => {
  const fake = fakeClient({ data: [{ id: '1' }], error: null });
  const rows = await listRecentItems(fake.client, { limit: 999 });
  assert.deepEqual(rows, [{ id: '1' }]);
  assert.deepEqual(fake.calls.at(-1), ['limit', 100]);
});

test('getItem rejects missing ids before querying', async () => {
  await assert.rejects(() => getItem({ from() { throw new Error('must not query'); } }), /item id is required/);
});
