import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const menu = readFileSync(new URL('../menu.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../menu.js', import.meta.url), 'utf8');

test('menu exposes a labelled toggle and controlled drawer', () => {
  assert.match(menu, /<button class="hamburger"[^>]*aria-expanded="false"[^>]*aria-controls="drawer"[^>]*aria-label="Open menu"/);
  assert.match(menu, /<aside id="drawer" class="drawer" hidden>/);
});

test('menu moves focus into the drawer and restores it on close', () => {
  assert.match(script, /this\._drawer\.querySelector\('a:not\(\[hidden\]\)'\)\?\.focus\(\);/);
  assert.match(script, /close\(\{ restoreFocus = true \} = \{\}\)/);
  assert.match(script, /if \(restoreFocus\) this\._hamburger\.focus\(\);/);
  assert.match(script, /this\.close\(\{ restoreFocus: false \}\);/);
});

test('menu keeps the toggle accessible name synchronized with its state', () => {
  assert.match(script, /this\._hamburger\.setAttribute\('aria-label', 'Close menu'\);/);
  assert.match(script, /this\._hamburger\.setAttribute\('aria-label', 'Open menu'\);/);
});

test('logout has a real fallback destination instead of a dead hash link', () => {
  assert.match(menu, /<a href="login\.html" id="logoutLink">/);
  assert.doesNotMatch(menu, /id="logoutLink"[^>]*href="#"/);
});
