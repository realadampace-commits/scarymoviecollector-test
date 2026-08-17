import test from 'node:test';
import assert from 'node:assert/strict';
import { listMyOrders } from '../src/data/orders.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    or(...args) { calls.push(['or', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },

    eq(...args) { calls.push(['eq', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); },
    then(resolve) { return Promise.resolve(result).then(resolve); }
  };
  return { client: { from(table) { calls.push(['from', table]); return builder; } }, calls };
}

test('listMyOrders requires a user id', async () => {
  await assert.rejects(() => listMyOrders({}, ''), /user id is required/);
});

test('order history is read-only and never exposes a client update path', async () => {
  const fake = fakeClient({ data: [{ id: 'o1', status: 'pending' }], error: null });
  const rows = await listMyOrders(fake.client, 'u1');
  assert.deepEqual(rows, [{ id: 'o1', status: 'pending' }]);
  assert.equal(fake.calls.some((x) => x[0] === 'update'), false);
});
