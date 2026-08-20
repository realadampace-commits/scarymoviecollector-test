import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../login.html', import.meta.url), 'utf8');

test('login fields expose labels and password-manager metadata', () => {
  assert.match(page, /<label for="email">Email<\/label>/);
  assert.match(page, /id="email"[^>]*autocomplete="email"[^>]*required/);
  assert.match(page, /<label for="password"[^>]*>Password<\/label>/);
  assert.match(page, /id="password"[^>]*autocomplete="current-password"[^>]*required/);
});

test('login feedback is announced without interrupting the page', () => {
  assert.match(page, /id="msg"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('login form supports keyboard submission without conflating sign-up', () => {
  assert.match(page, /<form id="authForm">/);
  assert.match(page, /id="signin"[^>]*type="submit"/);
  assert.match(page, /id="signup"[^>]*type="button"/);
});
