import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = `${readFileSync(resolve(import.meta.dirname, '../item-search.html'), 'utf8')}\n${readFileSync(resolve(import.meta.dirname, '../src/pages/item-search.js'), 'utf8')}`;

test('item search has a named form control and announced status', () => {
  assert.match(page, /<form class="controls" id="searchForm">/);
  assert.match(page, /<label class="sr-only" for="q">Search items<\/label>/);
  assert.match(page, /<input id="q" name="q" type="search"/);
  assert.match(page, /<div id="status"[^>]*role="status" aria-live="polite" aria-atomic="true">/);
});

test('item search prevents backend error details from becoming user-facing copy', () => {
  assert.match(page, /Unable to search items right now\. Please try again\./g);
  assert.doesNotMatch(page, /statusEl\.textContent = 'Error: ' \+/);
  assert.match(page, /resultsEl\.innerHTML = '';/);
  assert.match(page, /resultsEl\.innerHTML = '';\n  statusEl\.textContent = 'Searching…';/);
});

test('item search ignores stale responses when a newer query finishes first', () => {
  assert.match(page, /let searchToken=0;/);
  assert.match(page, /const requestId = \+\+searchToken;/);
  assert.match(page, /if \(requestId !== searchToken\) return;/g);
  assert.ok((page.match(/if \(requestId !== searchToken\) return;/g) || []).length >= 3);
});

test('item search escapes database values before inserting result markup', () => {
  assert.match(page, /item\.html\?id=\$\{escapeHtml\(it\.id\)\}/);
  assert.match(page, /src="\$\{escapeHtml\(it\.preview_url\)\}"/);
  assert.match(page, /<span>\$\{escapeHtml\(uname\)\}<\/span>/);
  assert.doesNotMatch(page, /src="\$\{it\.preview_url\}"/);
});