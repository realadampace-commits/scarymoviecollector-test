import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared visual system owns the product palette and typography', async () => {
  const css = await read('styles.css');
  assert.match(css, /--display-font:Georgia/);
  assert.match(css, /--accent:#b51f36!important/);
  assert.match(css, /--ink:#f0ede6!important/);
  assert.match(css, /body::after\{[^}]*feTurbulence/);
  assert.match(css, /\.card::before,\.panel::before\{[^}]*background:var\(--accent\)/);
});

test('legacy light-theme pages load the shared system last', async () => {
  for (const path of ['forum.html', 'messages.html', 'forum_post.html']) {
    const html = await read(path);
    assert.ok(html.lastIndexOf('/styles.css') > html.lastIndexOf('</style>'), `${path} must give the shared visual system final authority`);
  }
});

test('home presents the collection as an intentional branded archive', async () => {
  const html = await read('index.html');
  assert.match(html, /class="brand-hero"/);
  assert.match(html, /Private collection · public archive/);
  assert.match(html, /Catalog the objects that made horror history/);
});

test('shared menu follows the archive design instead of generic rounded UI', async () => {
  const menu = await read('menu.js');
  assert.match(menu, /border-radius:2px/);
  assert.match(menu, /text-transform:uppercase/);
  assert.match(menu, /border-left-color:#d6b178/);
});
