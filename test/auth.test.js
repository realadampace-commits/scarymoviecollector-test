import test from 'node:test';
import assert from 'node:assert/strict';
import { getSession, requireSession, signOut } from '../src/auth.js';

function clientWith(session, error = null) {
  const calls = [];
  return {
    calls,
    auth: {
      async getSession() { calls.push('getSession'); return { data: { session }, error }; },
      async signOut() { calls.push('signOut'); return { error }; }
    }
  };
}

test('getSession returns null for an anonymous client', async () => {
  assert.equal(await getSession(clientWith(null)), null);
});

test('requireSession rejects anonymous access', async () => {
  await assert.rejects(() => requireSession(clientWith(null)), /authentication required/);
});

test('signOut delegates to Supabase auth', async () => {
  const client = clientWith({ user: { id: 'u1' } });
  await signOut(client);
  assert.deepEqual(client.calls, ['signOut']);
});
