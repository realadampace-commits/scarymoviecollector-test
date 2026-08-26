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

test('saveItemVote rejects malformed identities before database access', async () => {
  let queried = false;
  const client = { from() { queried = true; throw new Error('database should not be queried'); } };

  await assert.rejects(
    () => saveItemVote(client, { itemId: 123, voterId: 'u1', agree: true }),
    /item and voter ids must be strings/
  );
  await assert.rejects(
    () => saveItemVote(client, { itemId: 'i1', voterId: {}, agree: true }),
    /item and voter ids must be strings/
  );
  assert.equal(queried, false);
});
