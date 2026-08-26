import test from 'node:test';
import assert from 'node:assert/strict';
import { updateOwnItem } from '../src/data/item-edit.js';

function fakeClient(result = { data: { id: 'item-1' }, error: null }) {
  const calls = [];
  const client = { calls, from(table) { calls.push({ table }); return { update(patch) { calls.push({ patch }); return { eq(field, value) { calls.push({ field, value }); return { eq(field2, value2) { calls.push({ field: field2, value: value2 }); return { select() { return { maybeSingle: async () => result }; } }; } }; } }; } }; } };
  return client;
}

test('updateOwnItem applies item and owner filters and drops protected fields', async () => {
  const client = fakeClient();
  await updateOwnItem(client, 'item-1', 'owner-1', { title: 'New', user_value: 4, owner_id: 'attacker', sold: true });
  assert.deepEqual(client.calls[1].patch, { title: 'New', user_value: 4, sold: true });
  assert.deepEqual(client.calls.slice(2), [{ field: 'id', value: 'item-1' }, { field: 'owner_id', value: 'owner-1' }]);
});

test('updateOwnItem rejects invalid values before writing', async () => {
  for (const userValue of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const client = fakeClient();
    await assert.rejects(() => updateOwnItem(client, 'item-1', 'owner-1', { user_value: userValue }), /value must be a finite non-negative number/);
    assert.deepEqual(client.calls, []);
  }
});

test('updateOwnItem writes the authoritative user_value column', async () => {
  const client = fakeClient();
  await updateOwnItem(client, 'item-1', 'owner-1', { title: 'Mask', user_value: 125, price: 999 });
  assert.deepEqual(client.calls[1].patch, { title: 'Mask', user_value: 125 });
});

test('updateOwnItem rejects empty patches', async () => {
  await assert.rejects(() => updateOwnItem(fakeClient(), 'item-1', 'owner-1', {}), /no editable fields/);
});
