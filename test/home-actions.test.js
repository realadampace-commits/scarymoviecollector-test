import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homeActionsForSession } from '../src/data/home-actions.js';

const homePage = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');

test('home status messaging is announced without interrupting browsing', () => {
  assert.match(homePage, /id="msg" class="muted" role="status" aria-live="polite" aria-atomic="true"/);
});

test('home provides a keyboard skip link to the primary collection content', () => {
  assert.match(homePage, /<a class="skip-link" href="#main-content">Skip to collection<\/a>/);
  assert.match(homePage, /<main id="main-content" class="wrap" tabindex="-1">/);
});

test('home actions route signed-in users directly to create and settings', () => {
  assert.deepEqual(homeActionsForSession({ user: { id: 'u1' } }), {
    addItem: { href: 'create.html', label: 'Add an item' },
    settings: { href: 'settings.html', label: 'Settings' },
  });
});

test('home actions retain login routes for guests', () => {
  assert.deepEqual(homeActionsForSession(null), {
    addItem: { href: 'login.html?next=create.html', label: 'Log in to add an item' },
    settings: { href: 'login.html?next=settings.html', label: 'Log in for settings' },
  });
});

test('home item loading errors offer a retry without exposing backend error details', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../src/pages/home.js'), 'utf8');
  assert.match(script, /Retry loading items/);
  assert.match(script, /msgEl\.addEventListener\('click'/);
  assert.match(script, /loadHome\(\)\.catch\(renderLoadError\)/);
  assert.doesNotMatch(script, /Unable to load items: \$\{detail\}/);
});
