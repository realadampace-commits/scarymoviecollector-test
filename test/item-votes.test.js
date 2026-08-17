import test from 'node:test';
import assert from 'node:assert/strict';
import { getItemVotes, saveItemVote } from '../src/data/item-votes.js';

test('getItemVotes aggregates agreement and suggestions', async () => {
  const client = { from() { return { select() { return this; }, eq() { return Promise.resolve({ data: [{ agree: true }, { agree: false, suggested_price: 10 }, { agree: false, suggested_price: 20 }], error: null }); } }; } };
  assert.deepEqual(await getItemVotes(client, 'i1'), { votes: [{ agree: true }, { agree: false, suggested_price: 10 }, { agree: false, suggested_price: 20 }], agree: 1, disagree: 2, averageSuggested: 15 });
});

test('saveItemVote requires a valid price for disagreement', async () => {
  await assert.rejects(() => saveItemVote({}, { itemId: 'i1', voterId: 'u1', agree: false }), /suggested price/);
});
