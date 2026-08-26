import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageUploadPlan } from '../src/data/item-image-writes.js';
import { uploadOwnItemImages } from '../src/data/item-image-upload.js';

test('validateImageUploadPlan enforces image type and five-image cap', () => {
  assert.deepEqual(validateImageUploadPlan(2, [{ name: 'a.png', type: 'image/png', size: 10 }]), [{ name: 'a.png', type: 'image/png', size: 10 }]);
  assert.throws(() => validateImageUploadPlan(5, [{ name: 'a.png', type: 'image/png', size: 10 }]), /maximum/);
  assert.throws(() => validateImageUploadPlan(0, [{ name: 'a.txt', type: 'text/plain', size: 10 }]), /image files/);
});

test('validateImageUploadPlan rejects invalid inputs', () => {
  assert.throws(() => validateImageUploadPlan(-1, []), /count/);
  assert.throws(() => validateImageUploadPlan(0, null), /array/);
});

test('validateImageUploadPlan rejects empty, invalid-size, and oversized images before upload', () => {
  for (const size of [0, Number.NaN, Number.POSITIVE_INFINITY, 10 * 1024 * 1024 + 1]) {
    assert.throws(
      () => validateImageUploadPlan(0, [{ name: 'poster.png', type: 'image/png', size }]),
      /image size/
    );
  }
});

function uploadClient({ item = { id: 'item-1' }, count = 0, rowError = null } = {}) {
  const calls = [];
  const client = {
    from(table) {
      calls.push(['from', table]);
      if (table === 'items') return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: item, error: null }) };
      if (table === 'items_images') return {
        deleting: false,
        select() { return this; },
        eq() { return this.deleting ? this : { count, error: null }; },
        insert(value) { calls.push(['insert', value]); return Promise.resolve({ error: rowError }); },
        delete() { this.deleting = true; return this; },
        in() { calls.push(['delete-images']); return Promise.resolve({ error: null }); }
      };
      throw new Error(`unexpected table ${table}`);
    },
    storage: { from() { return {
      upload: async (path) => { calls.push(['upload', path]); return { error: null }; },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      remove: async (paths) => { calls.push(['remove', paths]); return { error: null }; }
    }; } }
  };
  return { client, calls };
}

test('uploadOwnItemImages verifies ownership before uploading', async () => {
  const fake = uploadClient({ item: null });
  await assert.rejects(() => uploadOwnItemImages(fake.client, 'item-1', 'owner-1', [{ name: 'a.png', type: 'image/png', size: 10 }]), /ownership/);
  assert.equal(fake.calls.some(([kind]) => kind === 'upload'), false);
});

test('uploadOwnItemImages removes already-uploaded files when row insert fails', async () => {
  const fake = uploadClient({ rowError: new Error('row failed') });
  await assert.rejects(() => uploadOwnItemImages(fake.client, 'item-1', 'owner-1', [{ name: 'a bad.png', type: 'image/png', size: 10 }]), /row failed/);
  assert.equal(fake.calls.filter(([kind]) => kind === 'upload').length, 1);
  assert.equal(fake.calls.filter(([kind]) => kind === 'remove').length, 1);
});
