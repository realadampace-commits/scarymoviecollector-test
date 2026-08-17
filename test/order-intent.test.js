import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderIntent, createOrderIntent } from '../src/data/order-intent.js';

test('buildOrderIntent creates an unpaid order payload', () => {
  assert.deepEqual(buildOrderIntent({ itemId: 'i', buyerId: 'b', sellerId: 's', priceUsdc: 1250 }), {
    item_id: 'i', buyer_id: 'b', seller_id: 's', price_usdc: 1250, currency: 'USDC', method: 'USDC_BASE'
  });
});

test('buildOrderIntent rejects self-purchases and invalid prices', () => {
  assert.throws(() => buildOrderIntent({ itemId: 'i', buyerId: 'u', sellerId: 'u', priceUsdc: 1 }), /differ/);
  assert.throws(() => buildOrderIntent({ itemId: 'i', buyerId: 'b', sellerId: 's', priceUsdc: 0 }), /positive/);
});

test('createOrderIntent explicitly inserts pending status', async () => {
  let inserted;
  const chain = { insert(value) { inserted = value; return this; }, select() { return this; }, maybeSingle() { return Promise.resolve({ data: { id: 'o' }, error: null }); } };
  await createOrderIntent({ from() { return chain; } }, { itemId: 'i', buyerId: 'b', sellerId: 's', priceUsdc: 1 });
  assert.equal(inserted.status, 'pending');
  assert.equal(inserted.tx_hash, undefined);
});
