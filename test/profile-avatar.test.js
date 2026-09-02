import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profileAvatarMarkup } from '../src/ui.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('profileAvatarMarkup renders a photo and its frame with proportional saved geometry', () => {
  const html = profileAvatarMarkup({
    username: 'admin', avatar_url: 'https://example.com/avatar.jpg', frame_url: 'https://example.com/frame.png',
    frame_scale: 1.25, frame_offset_x: 12, frame_offset_y: -6
  }, { className: 'avatar', label: "admin's profile picture" });
  assert.match(html, /class="profile-avatar avatar"/);
  assert.match(html, /profile-avatar-photo/);
  assert.match(html, /profile-avatar-frame/);
  assert.match(html, /--frameScale:1\.25;--frameX:10%;--frameY:-5%/);
  assert.match(html, /aria-label="admin&#39;s profile picture"/);
});

test('profileAvatarMarkup clamps malformed frame geometry and escapes profile values', () => {
  const html = profileAvatarMarkup({ username: '<b>', avatar_url: 'x" onerror="bad', frame_url: '<frame>', frame_scale: 99, frame_offset_x: -999 });
  assert.match(html, /--frameScale:2;--frameX:-66\.666/);
  assert.doesNotMatch(html, /<b>|onerror="bad/);
});

test('every compact avatar surface uses the shared framed-avatar renderer and requests geometry', async () => {
  const paths = ['src/pages/messages.js', 'src/pages/forum.js', 'src/pages/forum-category.js', 'src/pages/forum-post.js', 'src/pages/item-search.js'];
  for (const path of paths) {
    const source = await read(path);
    assert.match(source, /profileAvatarMarkup/, `${path} must use shared avatar markup`);
    if (source.includes("from('profiles')")) {
      assert.match(source, /frame_url,frame_scale,frame_offset_x,frame_offset_y/, `${path} must query complete frame geometry`);
    }
  }
});

test('shared avatar CSS owns photo and frame sizing', async () => {
  const css = await read('styles.css');
  assert.match(css, /\.profile-avatar \{[^}]*width:var\(--avatar-size,40px\)[^}]*overflow:visible/);
  assert.match(css, /\.profile-avatar-frame \{[^}]*width:100%!important[^}]*object-fit:contain!important/);
  assert.match(css, /transform:translate\(var\(--frameX,0px\),var\(--frameY,0px\)\) scale\(var\(--frameScale,1\)\)/);
});
