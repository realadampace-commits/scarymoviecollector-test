import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../portfolio.html', import.meta.url), 'utf8');

test('portfolio range summary announces chart updates to assistive technology', () => {
  assert.match(page, /id="change" class="value-summary" role="status" aria-live="polite" aria-atomic="true"/);
});

test('portfolio range abbreviations have explicit spoken labels', () => {
  assert.match(page, /data-range="1W"[^>]*aria-label="1 week"/);
  assert.match(page, /data-range="1M"[^>]*aria-label="1 month"/);
  assert.match(page, /data-range="3M"[^>]*aria-label="3 months"/);
  assert.match(page, /data-range="6M"[^>]*aria-label="6 months"/);
  assert.match(page, /data-range="1Y"[^>]*aria-label="1 year"/);
  assert.match(page, /data-range="ALL"[^>]*aria-label="All time"/);
});


test('portfolio content is exposed as the page main landmark', () => {
  assert.match(page, /<main class="wrap">/);
  assert.match(page, /<\/main>\s*<script type="module" src="\/src\/pages\/portfolio\.js">/);
  assert.doesNotMatch(page, /<div class="wrap">/);
});
