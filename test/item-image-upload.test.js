import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadOwnItemImages } from '../src/data/item-image-upload.js';

test('uploadOwnItemImages removes inserted image rows when a later upload fails', async () => {
  const deleted = [];
  const removed = [];
  let inserts = 0;
  const client = {
    from(table) {
      if (table === 'items') {
        return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: { id: 'item-1' }, error: null }); } };
      }
      if (table === 'items_images') {
        return {
          select() { return this; },
          eq(field, value) {
            if (field === 'item_id' && this.deleting) deleted.push(['item_id', value]);
            return this;
          },
          insert() {
            inserts += 1;
            return Promise.resolve(inserts === 2 ? { error: new Error('row insert failed') } : { error: null });
          },
          delete() { this.deleting = true; return this; },
          in(field, values) { deleted.push([field, values]); return Promise.resolve({ error: null }); },
          then(resolve) { return Promise.resolve({ count: 0, error: null }).then(resolve); }
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from() {
        return {
          upload() { return Promise.resolve({ error: null }); },
          getPublicUrl(path) { return { data: { publicUrl: `https://images.example/${path}` } }; },
          remove(paths) { removed.push(paths); return Promise.resolve({ error: null }); }
        };
      }
    }
  };
  const files = [
    { name: 'front.jpg', type: 'image/jpeg', size: 10 },
    { name: 'back.jpg', type: 'image/jpeg', size: 10 }
  ];

  await assert.rejects(() => uploadOwnItemImages(client, 'item-1', 'owner-1', files), /row insert failed/);

  assert.deepEqual(deleted[0], ['item_id', 'item-1']);
  assert.equal(deleted[1][0], 'image_url');
  assert.equal(deleted[1][1].length, 2);
  assert.equal(removed.length, 2);
});
