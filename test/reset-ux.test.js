import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../reset.html', import.meta.url), 'utf8');

test('password reset fields have visible labels and native validation metadata', () => {
  assert.match(page, /<form id="resetForm">/);
  assert.match(page, /<label for="pwd1">New password<\/label>/);
  assert.match(page, /id="pwd1"[^>]*autocomplete="new-password"[^>]*minlength="6"[^>]*required/);
  assert.match(page, /<label for="pwd2">Repeat new password<\/label>/);
  assert.match(page, /id="pwd2"[^>]*autocomplete="new-password"[^>]*minlength="6"[^>]*required/);
});

test('password reset can be submitted with the keyboard', () => {
  assert.match(page, /id="save"[^>]*type="submit"/);
});