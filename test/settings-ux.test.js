import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../settings.html', import.meta.url), 'utf8');

test('settings action feedback is announced and not silently missed', () => {
  const messageIds = ['avatarMsg', 'userMsg', 'bioMsg', 'showcaseMsg', 'frameMsg', 'uploadMsg', 'pwdMsg', 'logoutMsg'];
  for (const id of messageIds) {
    assert.match(page, new RegExp(`<span id="${id}"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"`));
  }
});

test('settings save actions announce progress and prevent duplicate submissions', async () => {
  const source = await readFile(new URL('../src/pages/settings.js', import.meta.url), 'utf8');
  assert.match(source, /if \(button\?\.disabled\) return;/);
  assert.match(source, /button\.disabled = true/);
  assert.match(source, /message\.textContent = 'Saving…'/);
  assert.match(source, /finally \{ if \(button\) button\.disabled = false; \}/);
  assert.match(source, /save\(\{ username: username\.value\.trim\(\) \}, 'userMsg', 'saveUsername'\)/);
});

test('uploaded frames are selected immediately instead of requiring a reload', async () => {
  const source = await readFile(new URL('../src/pages/settings.js', import.meta.url), 'utf8');
  assert.match(source, /frames\.push\(frame\); selectedFrame = frame; renderFrame\(frame\); message\.textContent = 'Frame uploaded and selected\. Save to apply it\.';/);
  assert.doesNotMatch(source, /Frame uploaded\. Reload to use it\./);
});

test('frame choices expose and update their selected state', async () => {
  const source = await readFile(new URL('../src/pages/settings.js', import.meta.url), 'utf8');
  assert.match(source, /card\.setAttribute\('aria-pressed', String\(isSelected\)\)/);
  assert.match(source, /row\.querySelectorAll\('\.frameCard'\)\.forEach\(\(option\) => \{ option\.classList\.remove\('sel'\); option\.setAttribute\('aria-pressed', 'false'\); \}\)/);
  assert.match(source, /card\.classList\.add\('sel'\); card\.setAttribute\('aria-pressed', 'true'\); renderFrame\(frame\)/);
});

test('profile picture upload explains the required selection before starting', async () => {
  assert.match(page, /<label class="muted" for="avatarFile">Choose a profile picture<\/label>/);
  const source = await readFile(new URL('../src/pages/settings.js', import.meta.url), 'utf8');
  assert.match(source, /if \(!file\) \{ message\.textContent = 'Choose an image before uploading\.'; return; \}/);
});

test('settings text controls have explicit labels and useful input metadata', () => {
  assert.doesNotMatch(page, /usdcAddr|USDC \(Base\)|wallet address/);
  assert.doesNotMatch(page, /saveUsdc|usdcMsg/);
  assert.match(page, /<label class="muted" for="username">New username<\/label>/);
  assert.match(page, /id="username" name="username" autocomplete="username"/);
  assert.match(page, /<label class="muted" for="bioInput">About you<\/label>/);
  assert.match(page, /id="bioInput" name="bio" autocomplete="off"/);
  assert.match(page, /<label class="muted" for="showcaseInput">Item IDs<\/label>/);
  assert.match(page, /id="showcaseInput" name="showcase" autocomplete="off"/);
});

test('owner frame upload controls have explicit labels and retained constraints', () => {
  assert.match(page, /<label class="muted" for="frameTitle">Frame title \(optional\)<\/label>/);
  assert.match(page, /id="frameTitle" name="frameTitle" autocomplete="off"/);
  assert.match(page, /<label class="muted" for="frameScale">Frame scale<\/label>/);
  assert.match(page, /id="frameScale" name="frameScale" type="number" step="0\.01" min="0\.5" max="2"/);
  assert.match(page, /<label class="muted" for="frameFile">Frame image<\/label>/);
  assert.match(page, /id="frameFile" name="frameFile" type="file" accept="image\/\*"/);
});

test('frame editor exposes dialog semantics and associated range labels', () => {
  assert.match(page, /<div id="frameEditor" role="dialog" aria-modal="true" aria-labelledby="frameEditorTitle"/);
  assert.match(page, /<h3 id="frameEditorTitle"[^>]*>Edit Frame<\/h3>/);
  for (const [id, describedBy] of [['feX', 'feXv'], ['feY', 'feYv'], ['feS', 'feSv']]) {
    assert.match(page, new RegExp(`<label for="${id}">`));
    assert.match(page, new RegExp(`<input id="${id}"[^>]*aria-describedby="${describedBy}"`));
  }
});