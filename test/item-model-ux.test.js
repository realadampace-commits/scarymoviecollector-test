import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('create and edit forms accept a model package with common companion files', async () => {
  const [createHtml, editHtml] = await Promise.all([read('create.html'), read('edit.html')]);
  for (const html of [createHtml, editHtml]) {
    assert.match(html, /id="modelFiles"/);
    assert.match(html, /\.glb,\.gltf,\.obj,\.mtl,\.fbx,\.stl,\.bin,\.png,\.jpg,\.jpeg,\.webp/);
    assert.match(html, /multiple/);
    assert.match(html, /100 MB/);
  }
});

test('item page only reveals the 3D toggle when model metadata exists', async () => {
  const [html, script] = await Promise.all([read('item.html'), read('src/pages/item.js')]);
  assert.match(html, /id="mediaToggle"[^>]*display:none/);
  assert.match(html, /id="viewModel"[^>]*>View in 3D</);
  assert.match(script, /if \(model\)/);
  assert.match(script, /toggle\.style\.display = 'flex'/);
  assert.match(script, /import\('\.\.\/3d\/model-viewer\.js'\)/);
  assert.match(script, /mountModelViewer\(viewer, model\)/);
});

test('3D viewer supports orbit controls and every advertised primary format', async () => {
  const source = await read('src/3d/model-viewer.js');
  for (const loader of ['GLTFLoader', 'OBJLoader', 'MTLLoader', 'FBXLoader', 'STLLoader', 'OrbitControls']) assert.match(source, new RegExp(loader));
  assert.match(source, /setURLModifier/);
  assert.match(source, /assets\.get\(name\)/);
  assert.match(source, /\^https\?:/);
});
