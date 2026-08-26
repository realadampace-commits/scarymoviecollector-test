import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteOwnItem } from '../src/data/items.js';

test('deleteOwnItem requires both ids', async () => {
  await assert.rejects(() => deleteOwnItem({}, 'item', ''), /ids are required/);
});

test('deleteOwnItem applies both item and owner filters', async () => {
  const calls = [];
  const builder = {
    delete() { calls.push('delete'); return this; },
    eq(...args) { calls.push(args); return this; },
    select(...args) { calls.push(['select', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve({ data: { id: 'item' }, error: null }); },
  };
  await deleteOwnItem({ from() { return builder; } }, 'item', 'owner');
  assert.deepEqual(calls, ['delete', ['id', 'item'], ['owner_id', 'owner'], ['select', 'id'], ['maybeSingle']]);
});
