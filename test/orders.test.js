import test from 'node:test';
import assert from 'node:assert/strict';
import { listMyOrders, updateOrder } from '../src/data/orders.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    or(...args) { calls.push(['or', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },
    update(...args) { calls.push(['update', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); }
  };
  return { client: { from(table) { calls.push(['from', table]); return builder; } }, calls };
}

test('listMyOrders requires a user id', async () => {
  await assert.rejects(() => listMyOrders({}, ''), /user id is required/);
});

test('updateOrder excludes immutable payment identity fields', async () => {
  const fake = fakeClient({ data: { id: 'o1' }, error: null });
  await updateOrder(fake.client, 'o1', { status: 'shipped', tx_hash: 'attacker', price_usdc: 1 });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'update')[1], { status: 'shipped' });
});
