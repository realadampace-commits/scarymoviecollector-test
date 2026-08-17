import test from 'node:test';
import assert from 'node:assert/strict';
import { getItemDetail } from '../src/data/item-detail.js';

function clientFor({ item = null } = {}) {
  return {
    from(table) {
      const rows = {
        items: item ? [item] : [],
        profiles: [{ id: 'u1', username: 'nate' }],
        items_images: [{ image_url: 'https://cdn.test/a.jpg', position: 0 }],
        item_votes: [{ agree: true }]
      }[table] ?? [];
      const builder = {
        select() { return this; }, eq() { return this; }, order() { return this; },
        maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
        then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); }
      };
      return builder;
    }
  };
}

test('getItemDetail composes item, owner, images, and votes', async () => {
  const result = await getItemDetail(clientFor({ item: { id: 'i1', owner_id: 'u1', title: 'Scream' } }), 'i1');
  assert.equal(result.item.title, 'Scream');
  assert.equal(result.owner.username, 'nate');
  assert.equal(result.images[0].image_url, 'https://cdn.test/a.jpg');
  assert.equal(result.votes.agree, 1);
});

test('getItemDetail returns null for missing items', async () => {
  assert.equal(await getItemDetail(clientFor(), 'missing'), null);
});
