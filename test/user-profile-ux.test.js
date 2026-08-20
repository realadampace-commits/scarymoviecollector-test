import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../user.html', import.meta.url), 'utf8');

test('user profile exposes an honest loading and error status', () => {
  assert.match(page, /id="profileStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(page, /Loading profile…/);
  assert.match(page, /Check your connection and try again\./);
  assert.match(page, /<a id="portfolioLink" href="portfolio\.html"/);
  assert.match(page, /portfolioLink\.href = 'portfolio\.html\?u=' \+ encodeURIComponent\(profile\.username\)/);
  assert.doesNotMatch(page, /<a id="portfolioLink" href="#"/);
  assert.doesNotMatch(page, /\[debug\]/);
  assert.doesNotMatch(page, /console\.log\('\[user\.html\]'/);
});
