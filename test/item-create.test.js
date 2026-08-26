import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnItem } from '../src/data/item-create.js';

test('createOwnItem writes owner-scoped collection fields and returns id', async () => {
  const calls = [];
  const builder = {
    insert(payload) { calls.push(['insert', payload]); return this; },
    select(fields) { calls.push(['select', fields]); return this; },
    single: async () => ({ data: { id: 'item-1' }, error: null }),
  };
  const item = await createOwnItem({ from() { return builder; } }, 'owner-1', {
    title: '  Mask  ', description: '  notes ', userValue: '42', files: [],
  });
  assert.deepEqual(item, { id: 'item-1' });
  assert.deepEqual(calls, [
    ['insert', { owner_id: 'owner-1', title: 'Mask', description: 'notes', user_value: 42 }],
    ['select', 'id'],
  ]);
});

test('createOwnItem validates required and numeric fields before database access', async () => {
  let accessed = false;
  const client = { from() { accessed = true; return {}; } };
  await assert.rejects(() => createOwnItem(client, 'owner-1', { title: '', userValue: 1 }), /title is required/);
  await assert.rejects(() => createOwnItem(client, 'owner-1', { title: 'x', userValue: '1.5' }), /whole number/);
  assert.equal(accessed, false);
});

test('createOwnItem preserves the upload failure when rollback also fails', async () => {
  let itemQueries = 0;
  const client = {
    from(table) {
      if (table !== 'items') throw new Error(`unexpected table ${table}`);
      itemQueries += 1;
      if (itemQueries === 1) {
        return { insert() { return this; }, select() { return this; }, single: async () => ({ data: { id: 'item-1' }, error: null }) };
      }
      if (itemQueries === 2) {
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: new Error('upload lookup failed') }) };
      }
      let rollbackFilters = 0;
      return {
        delete() { return this; },
        eq() {
          rollbackFilters += 1;
          return rollbackFilters === 1 ? this : Promise.reject(new Error('rollback failed'));
        },
      };
    },
  };

  await assert.rejects(
    () => createOwnItem(client, 'owner-1', { title: 'Mask', userValue: 42, files: [{ name: 'mask.jpg', type: 'image/jpeg', size: 1 }] }),
    /upload lookup failed/
  );
});

test('createOwnItem preserves upload failure when rollback resolves with an error', async () => {
  let itemQueries = 0;
  const client = {
    from() {
      itemQueries += 1;
      if (itemQueries === 1) return { insert() { return this; }, select() { return this; }, single: async () => ({ data: { id: 'item-1' }, error: null }) };
      if (itemQueries === 2) return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: new Error('upload failed') }) };
      return { delete() { return this; }, eq() { return this; }, then(resolve) { resolve({ error: new Error('rollback failed') }); } };
    },
  };
  await assert.rejects(
    () => createOwnItem(client, 'owner-1', { title: 'Mask', userValue: 42, files: [{ name: 'mask.jpg', type: 'image/jpeg', size: 1 }] }),
    /upload failed/
  );
});
