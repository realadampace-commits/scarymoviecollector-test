import test from 'node:test';
import assert from 'node:assert/strict';
import { homeActionsForSession } from '../src/data/home-actions.js';

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
