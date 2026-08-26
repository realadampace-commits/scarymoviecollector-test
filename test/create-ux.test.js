import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../create.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../src/pages/create.js', import.meta.url), 'utf8');

test('create item form exposes labels, native validation, and announced feedback', () => {
  assert.match(page, /<label for="title">Title<\/label>/);
  assert.match(page, /<label for="desc">Description<\/label>/);
  assert.match(page, /<label for="price">Your value \(\$\)<\/label>/);
  assert.match(page, /<label class="muted" for="imgFiles">Item images<\/label>/);
  assert.match(page, /id="title"[^>]*required/);
  assert.match(page, /id="msg"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(page, /<form id="createForm">/);
  assert.match(page, /<button id="saveBtn" type="submit">Create Item<\/button>/);
});

test('create item uses form submission so keyboard and native validation work', () => {
  assert.match(source, /createForm\.addEventListener\('submit', async \(event\) => \{/);
  assert.match(source, /event\.preventDefault\(\);/);
  assert.doesNotMatch(source, /saveBtn\.addEventListener\('click'/);
});

test('image selection feedback remains actionable when more than five files are chosen', () => {
  assert.match(source, /Only the first 5 images will be used\./);
  assert.match(source, /Only the first 5 images will be used\. Select at most 5 images\./);
});


test('create image picker exposes its selection guidance to assistive technology', () => {
  assert.match(page, /id=\"imgFiles\"[^>]*aria-describedby=\"imageHelp\"/);
  assert.match(page, /id=\"imageHelp\"[^>]*>Tip: select up to 5 images\./);
});
