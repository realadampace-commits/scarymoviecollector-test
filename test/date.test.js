import test from 'node:test';
import assert from 'node:assert/strict';
import { formatShortDate } from '../src/utils/date.js';

test('formatShortDate fails closed for invalid dates', () => {
  assert.equal(formatShortDate('not-a-date', { month: 'short', day: 'numeric' }), 'Unknown date');
});

test('formatShortDate fails closed with full forum timestamp options', () => {
  assert.equal(formatShortDate('not-a-date', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit'
  }), 'Unknown date');
});

test('formatShortDate formats valid dates', () => {
  assert.match(formatShortDate('2025-10-31T12:00:00Z', { year: 'numeric' }), /2025/);
});
