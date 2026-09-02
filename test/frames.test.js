import test from 'node:test';
import assert from 'node:assert/strict';
import { listFrames, frameStyle } from '../src/data/frames.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return Promise.resolve(result); }
  };
  return { client: { from(table) { calls.push(['from', table]); return builder; } }, calls };
}

test('listFrames reads the public frames gallery in creation order', async () => {
  const fake = fakeClient({ data: [{ id: 'f1' }], error: null });
  assert.deepEqual(await listFrames(fake.client), [{ id: 'f1' }]);
  assert.deepEqual(fake.calls, [['from', 'frames'], ['select', 'id,title,image_url,scale,offset_x,offset_y'], ['order', 'created_at', { ascending: true }]]);
});

test('frameStyle maps stored frame positioning to CSS variables', () => {
  assert.deepEqual(frameStyle({ scale: 1.2, offset_x: -4, offset_y: 7 }), {
    '--frameScale': '1.2', '--frameX': '-3.3333333333333335%', '--frameY': '5.833333333333334%'
  });
});
