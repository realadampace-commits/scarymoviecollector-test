import test from 'node:test';
import assert from 'node:assert/strict';
import { getProfile, listProfiles, searchProfiles, updateOwnProfile } from '../src/data/profiles.js';

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
  await searchProfiles({ rpc(name,args) { calls.push([name,args]); return Promise.resolve({data:[],error:null}); } }, String.raw`100%_real\name`);
  assert.deepEqual(calls[0], ['search_visible_profiles', { search_term: String.raw`100%_real\name`, result_limit: 50, result_offset: 0 }]);
});

test('listProfiles returns every page of a username-sorted browsable directory', async () => {
  const calls = [];
  const pages = [[{ id: 'u1', username: 'admin', role: 'owner' }], [{ id: 'u2', username: 'member', role: 'free' }], []];
  const result = await listProfiles({ rpc(name,args) { calls.push([name,args]); return Promise.resolve({data:pages.shift(),error:null}); } }, { pageSize: 1 });
  assert.deepEqual(result, [
    { id: 'u1', username: 'admin', role: 'owner' },
    { id: 'u2', username: 'member', role: 'free' },
  ]);
  assert.deepEqual(calls.map(([,args])=>args.result_offset),[0,1,2]);
});

test('updateOwnProfile drops role and other protected fields', async () => {
  const fake = fakeClient({ data: { id: 'u1' }, error: null });
  await updateOwnProfile(fake.client, 'u1', { bio: 'hello', role: 'owner', id: 'attacker' });
  assert.deepEqual(fake.calls.find((x) => x[0] === 'update')[1], { bio: 'hello' });
});
