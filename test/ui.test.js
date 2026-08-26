import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDate, formatUsd } from '../src/ui.js';

test('escapeHtml neutralizes markup characters', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('escapeHtml handles nullish values', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('formatUsd formats finite values and fails closed', () => {
  assert.equal(formatUsd(12.5), '$12.50');
  assert.equal(formatUsd('bad'), '$0.00');
});

test('formatDate keeps malformed database dates from breaking a rendered list', () => {
  assert.equal(formatDate('not-a-date'), 'Date unavailable');
  assert.equal(formatDate(null), 'Date unavailable');
  assert.notEqual(formatDate('2026-08-22T12:00:00Z'), 'Date unavailable');
});
