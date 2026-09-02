import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared mobile layout stacks content grids instead of forcing side-by-side cards', async () => {
  const css = await read('styles.css');
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /\.grid \{ grid-template-columns:minmax\(0,1fr\)!important/);
  assert.doesNotMatch(css, /@media \(max-width:700px\)[\s\S]*?\.grid \{ grid-template-columns:repeat\(2/);
  assert.match(css, /\.top,\.head,\.topbar,\.title \{[^}]*flex-direction:column!important/);
  assert.match(css, /\.row \{ grid-template-columns:minmax\(0,1fr\)!important/);
});

test('mobile forms and action groups stack and remain within the viewport', async () => {
  const css = await read('styles.css');
  assert.match(css, /\.controls,\.tools,\.actions,#searchForm \{ flex-direction:column!important/);
  assert.match(css, /input,textarea,select \{ min-width:0; max-width:100%; \}/);
  assert.match(css, /\.compose,\.replyBox \{ grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css, /\.frame-editor-controls \{ grid-template-columns:minmax\(0,1fr\)!important/);
});

test('forum category cards no longer use two mobile columns', async () => {
  const html = await read('forum.html');
  assert.match(html, /category-list\{display:grid;grid-template-columns:minmax\(0,1fr\)\}/);
  assert.doesNotMatch(html, /category-list\{grid-template-columns:1fr 1fr\}/);
});
