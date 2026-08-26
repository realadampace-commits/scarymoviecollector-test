import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(resolve(import.meta.dirname, '../dm.html'), 'utf8');

test('direct message composer has an accessible name and keyboard guidance', () => {
  assert.match(page, /<label for="text" class="sr-only">Message<\/label>/);
  assert.match(page, /id="text"[^>]*aria-describedby="textHint"/);
  assert.match(page, /id="textHint"[^>]*>Press Enter to send, or Shift\+Enter for a new line\.<\/div>/);
});

test('direct message feedback is announced to assistive technology', () => {
  assert.match(page, /id="status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
});

test('direct message sending announces progress before the request completes', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/pages/dm.js'), 'utf8');
  assert.match(source, /status\.textContent = 'Sending…';/);
});

test('direct message composer ignores repeated submissions while a send is in progress', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/pages/dm.js'), 'utf8');
  const submit = source.slice(source.indexOf('async function submit()'), source.indexOf("send.addEventListener('click'"));
  assert.match(submit, /if \(sending\) return;/);
  assert.ok(submit.indexOf('sending = true;') < submit.indexOf('await sendMessage('));
  assert.match(submit, /finally \{ sending = false; send\.disabled = false; \}/);
});

test('direct message threads explain their empty state instead of showing a blank panel', async () => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/pages/dm.js'), 'utf8');
  assert.match(source, /messages\.length/);
  assert.match(source, /No messages yet\. Send a message to start the conversation\./);
});

test('direct message history exposes an explicit loading state', () => {
  assert.match(page, /id="list"[^>]*aria-busy="true"[^>]*aria-live="polite"[^>]*>\s*<p[^>]*>Loading messages…<\/p>/);
  const source = readFileSync(resolve(import.meta.dirname, '../src/pages/dm.js'), 'utf8');
  assert.match(source, /list\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(source, /list\.setAttribute\('aria-busy', 'false'\)/);
});

test('direct message history offers an inline retry after a failed load', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../src/pages/dm.js'), 'utf8');
  assert.match(source, /Unable to load messages right now\./);
  assert.match(source, /retry-messages/);
  assert.match(source, /list\.addEventListener\('click'/);
  assert.match(source, /if \(event\.target\.closest\('\.retry-messages'\)\) render\(\)/);
});