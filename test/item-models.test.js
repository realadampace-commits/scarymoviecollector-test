import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteOwnItemModel, getItemModel, uploadOwnItemModel, validateModelPackage } from '../src/data/item-models.js';

const file = (name, size = 10, type = '') => ({ name, size, type });

test('validateModelPackage accepts common model formats with companion textures', () => {
  for (const model of ['mask.glb', 'mask.gltf', 'mask.obj', 'mask.fbx', 'mask.stl']) {
    const plan = validateModelPackage([file(model), file('mask.mtl'), file('paint.png', 20, 'image/png')]);
    assert.equal(plan.primary.name, model);
    assert.equal(plan.format, model.split('.').pop());
  }
});

test('validateModelPackage rejects ambiguous, unsupported, oversized, and duplicate packages', () => {
  assert.throws(() => validateModelPackage([]), /Choose a 3D model/);
  assert.throws(() => validateModelPackage([file('readme.pdf')]), /not a supported/);
  assert.throws(() => validateModelPackage([file('a.glb'), file('b.obj')]), /exactly one primary/);
  assert.throws(() => validateModelPackage([file('A.glb'), file('a.glb')]), /exactly one primary/);
  assert.throws(() => validateModelPackage([file('a.glb', 101 * 1024 * 1024)]), /100 MB/);
  assert.throws(() => validateModelPackage([file('a.glb'), file('Texture.png'), file('texture.png')]), /unique filename/);
});

test('getItemModel returns null when an item has no model', async () => {
  const client = { from() { return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } }; } };
  assert.equal(await getItemModel(client, 'item-1'), null);
});

test('uploadOwnItemModel uploads a package and writes its public manifest', async () => {
  const uploaded = [];
  let row;
  const client = {
    from(table) {
      if (table === 'items') return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: { id: 'item-1' }, error: null }); } };
      if (table === 'item_models') return {
        select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        upsert(value) { row = value; return Promise.resolve({ error: null }); }
      };
      throw new Error(`unexpected table ${table}`);
    },
    storage: { from() { return {
      upload(path) { uploaded.push(path); return Promise.resolve({ error: null }); },
      getPublicUrl(path) { return { data: { publicUrl: `https://models.example/${path}` } }; },
      remove() { return Promise.resolve({ error: null }); }
    }; } }
  };
  const result = await uploadOwnItemModel(client, 'item-1', 'owner-1', [file('ghost face.obj'), file('ghost.mtl'), file('face texture.png', 20, 'image/png')]);
  assert.equal(uploaded.length, 3);
  assert.match(uploaded[0], /^owner-1\/item-1\/[^/]+\/ghost_face\.obj$/);
  assert.equal(row.model_format, 'obj');
  assert.equal(row.files.length, 3);
  assert.equal(row.files[0].type, 'application/octet-stream');
  assert.equal(row.files[2].type, 'image/png');
  assert.equal(result.model_url, row.model_url);
});

test('uploadOwnItemModel removes a partial package after an upload failure', async () => {
  const removed = [];
  let uploadCount = 0;
  const client = {
    from(table) {
      if (table === 'items') return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: { id: 'item-1' }, error: null }); } };
      return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } };
    },
    storage: { from() { return {
      upload() { uploadCount += 1; return Promise.resolve({ error: uploadCount === 2 ? new Error('upload failed') : null }); },
      getPublicUrl(path) { return { data: { publicUrl: path } }; },
      remove(paths) { removed.push(paths); return Promise.resolve({ error: null }); }
    }; } }
  };
  await assert.rejects(() => uploadOwnItemModel(client, 'item-1', 'owner-1', [file('mask.gltf'), file('mask.bin')]), /upload failed/);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].length, 1);
});

test('uploadOwnItemModel splits files above the Supabase object limit', async () => {
  const uploads = [];
  const largeFile = {
    name: 'large.glb', type: 'model/gltf-binary', size: 60 * 1024 * 1024,
    slice(start, end, type) { return { size: end - start, type }; }
  };
  let row;
  const client = {
    from(table) {
      if (table === 'items') return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: { id: 'item-1' }, error: null }); } };
      return {
        select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        upsert(value) { row = value; return Promise.resolve({ error: null }); }
      };
    },
    storage: { from() { return {
      upload(path, body) { uploads.push([path, body.size]); return Promise.resolve({ error: null }); },
      getPublicUrl(path) { return { data: { publicUrl: `https://models.example/${path}` } }; },
      remove() { return Promise.resolve({ error: null }); }
    }; } }
  };
  await uploadOwnItemModel(client, 'item-1', 'owner-1', [largeFile]);
  assert.equal(uploads.length, 2);
  assert.ok(uploads.every(([, size]) => size <= 45 * 1024 * 1024));
  assert.equal(row.files[0].parts.length, 2);
  assert.match(row.files[0].parts[0].path, /\.part-001$/);
});

test('deleteOwnItemModel deletes metadata and every stored package file', async () => {
  const removed = [];
  const model = { owner_id: 'owner-1', files: [{ parts: [{ path: 'one' }, { path: 'two' }] }] };
  const client = {
    from() { const query = {
      deleting: false,
      select() { return this; }, eq() { return this; },
      maybeSingle() { return Promise.resolve({ data: model, error: null }); },
      delete() { this.deleting = true; return this; },
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); }
    }; return query; },
    storage: { from() { return { remove(paths) { removed.push(paths); return Promise.resolve({ error: null }); } }; } }
  };
  await deleteOwnItemModel(client, 'item-1', 'owner-1');
  assert.deepEqual(removed, [['one', 'two']]);
});
