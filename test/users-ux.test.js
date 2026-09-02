import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'users.html'), 'utf8');

test('user search has an accessible named query and announced result status', () => {
  assert.match(page, /<label for="q">Username<\/label>/);
  assert.match(page, /<input id="q" name="q" type="search" autocomplete="username"/);
  assert.match(page, /<button id="searchSubmit" type="submit">Search<\/button>/);
  assert.match(page, /<div id="results" class="muted" role="status" aria-live="polite" aria-atomic="true">/);
});

test('user search exposes and manages its loading state without duplicate submits', () => {
  const script = fs.readFileSync(path.join(process.cwd(), 'src/pages/users.js'), 'utf8');
  assert.match(page, /<button id="searchSubmit" type="submit">Search<\/button>/);
  assert.match(script, /submit\.disabled = true/);
  assert.match(script, /results\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(script, /submit\.disabled = false/);
  assert.match(script, /results\.removeAttribute\('aria-busy'\)/);
});

test('user search gives each profile link a unique accessible name', () => {
  const script = fs.readFileSync(path.join(process.cwd(), 'src/pages/users.js'), 'utf8');
  assert.match(script, /aria-label=\"View @\$\{escapeHtml\(user\.username\)\} profile\"/);
});

test('user search does not expose internal profile identifiers', () => {
  const script = fs.readFileSync(path.join(process.cwd(), 'src/pages/users.js'), 'utf8');
  assert.doesNotMatch(script, /escapeHtml\(user\.id\)/);
});

test('user search offers an accessible retry after a failed request', () => {
  const script = fs.readFileSync(path.join(process.cwd(), 'src/pages/users.js'), 'utf8');
  assert.match(script, /Retry searching users/);
  assert.match(script, /\.retry-users/);
  assert.match(script, /runSearch\(input\.value\.trim\(\)\)/);
});

test('user search ignores stale results and loading cleanup from older requests', () => {
  const script = fs.readFileSync(path.join(process.cwd(), 'src/pages/users.js'), 'utf8');
  assert.match(script, /let searchToken = 0;/);
  assert.match(script, /const requestId = \+\+searchToken;/);
  assert.ok((script.match(/if \(requestId !== searchToken\) return;/g) || []).length >= 2);
  assert.match(script, /if \(requestId === searchToken\) \{[\s\S]*submit\.disabled = false;[\s\S]*results\.removeAttribute\('aria-busy'\);[\s\S]*\}/);
});
