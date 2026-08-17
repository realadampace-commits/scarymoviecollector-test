import test from 'node:test';
import assert from 'node:assert/strict';
import { firstImage, listItemImages } from '../src/data/item-images.js';

test('firstImage ignores missing URLs', () => {
  assert.equal(firstImage([{ image_url: null }, { image_url: 'https://cdn.test/a.jpg' }]), 'https://cdn.test/a.jpg');
  assert.equal(firstImage([]), null);
});

test('listItemImages rejects missing item ids', async () => {
  await assert.rejects(() => listItemImages({}, ''), /item id is required/);
});
