import test from 'node:test';
import assert from 'node:assert/strict';
import { getProfile, searchProfiles, updateOwnProfile } from '../src/data/profiles.js';

function fakeClient(result) {
  const calls = [];
  const builder = {
    select(...args) { calls.push(['select', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    update(...args) { calls.push(['update', ...args]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); }
  };
  return { client: { from(table) { calls.push(['from', table]); return builder; } }, calls };
}

test('getProfile rejects missing ids', async () => {
  await assert.rejects(() => getProfile({}, ''), /profile id is required/);
});

test('searchProfiles treats username wildcard characters literally', async () => {
  const calls = [];
  const chain = {
    select() { return this; },
    ilike(...args) { calls.push(args); return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: [], error: null }); }
  };

  await searchProfiles({ from() { return chain; } }, String.raw`100%_real\name`);

  assert.deepEqual(calls[0], ['username', String.raw`%100\%\_real\\name%`]);
});

test('updateOwnProfile drops role and other protected fields', async () => {
  const fake = fakeClient({ data: { id: 'u1' }, error: null });
  await updateOwnProfile(fake.client, 'u1', { bio: 'hello', role: 'owner', id: 'attacker' });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'update')[1], { bio: 'hello' });
});
