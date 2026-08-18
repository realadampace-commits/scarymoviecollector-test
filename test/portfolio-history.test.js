import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioHistory, selectPortfolioRange } from '../src/data/portfolio-history.js';

const items = [
  { created_at: '2026-01-01T00:00:00.000Z', user_value: 100 },
  { created_at: '2026-02-01T00:00:00.000Z', user_value: 25 },
  { created_at: '2026-03-01T00:00:00.000Z', user_value: '75' },
];

test('buildPortfolioHistory creates cumulative collection value points', () => {
  assert.deepEqual(buildPortfolioHistory(items), [
    { at: '2026-01-01T00:00:00.000Z', value: 100 },
    { at: '2026-02-01T00:00:00.000Z', value: 125 },
    { at: '2026-03-01T00:00:00.000Z', value: 200 },
  ]);
});

test('buildPortfolioHistory ignores invalid values and dates', () => {
  assert.deepEqual(buildPortfolioHistory([{ created_at: 'bad', user_value: 200 }, { created_at: '2026-01-01T00:00:00.000Z', user_value: -9 }]), []);
});

test('selectPortfolioRange keeps the appropriate recent points and preserves a baseline', () => {
  const history = buildPortfolioHistory(items);
  const now = new Date('2026-03-15T00:00:00.000Z');
  assert.deepEqual(selectPortfolioRange(history, '1M', now), [
    { at: '2026-02-01T00:00:00.000Z', value: 125 },
    { at: '2026-03-01T00:00:00.000Z', value: 200 },
  ]);
  assert.deepEqual(selectPortfolioRange(history, 'ALL', now), history);
});
