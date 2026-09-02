import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../edit.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../src/pages/edit.js', import.meta.url), 'utf8');

test('edit redirects guests to sign in and preserves the requested item', () => {
  assert.match(source, /try \{[\s\S]*session = await requireSession\(client\)/);
  assert.match(source, /location\.replace\(`login\.html\?next=\$\{encodeURIComponent\(`edit\.html\?id=\$\{id\}`\)\}`\)/);
  assert.match(source, /if \(session\) \{\s*const item = await getItem/);
});

test('edit page back navigation has a safe pre-load destination', () => {
  assert.match(page, /<a href="index\.html" id="backLink">← Back to item<\/a>/);
  assert.doesNotMatch(page, /<a href="#" id="backLink">/);
});

test('edit photos does not expose a non-functional delete action', () => {
  assert.doesNotMatch(page, /id="delBtn"/);
  assert.match(page, /Existing photos cannot be removed here\./);
});

test('edit photo uploader has an accessible label and usage guidance', () => {
  assert.match(page, /<label[^>]*for="newFiles"[^>]*>Add photos<\/label>/);
  assert.match(page, /id="photoHelp"/);
  assert.match(page, /id="newFiles"[^>]*aria-describedby="photoHelp"/);
});

test('edit selling controls are manual and contain no crypto payment fields', () => {
  assert.match(page, /Manual Sale Status/);
  assert.match(page, /Sales are arranged manually\. No payments are processed on this site\./);
  assert.doesNotMatch(page, /sellPriceUsdc|Price in USDC|USDC \(Base\)/);
  assert.match(page, /<label for="soldPrice">Sold price \(USD\)<\/label>/);
});

test('edit async actions expose live feedback and prevent duplicate saves', async () => {
  assert.match(page, /id="detailsMsg"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(page, /id="msg"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(source, /saveButton\.disabled = true; saveButton\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(source, /finally \{ saveButton\.disabled = false; saveButton\.removeAttribute\('aria-busy'\); \}/);
});

test('edit value reads and writes the authoritative user_value field', async () => {
  assert.match(source, /price\.value = item\.user_value \?\? ''/);
  assert.match(source, /user_value: Number\(price\.value\)/);
  assert.doesNotMatch(source, /price: Number\(price\.value\)/);
});
