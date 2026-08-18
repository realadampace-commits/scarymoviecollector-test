import test from 'node:test';
import assert from 'node:assert/strict';
import { getSession, requireSession, requestPasswordReset, resetPassword, signOut } from '../src/auth.js';

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

test('requestPasswordReset trims the email and uses the supplied recovery URL', async () => {
  const calls = [];
  const client = { auth: { async resetPasswordForEmail(email, options) { calls.push({ email, options }); return { data: {}, error: null }; } } };
  await requestPasswordReset(client, '  fan@example.com ', 'https://example.test/reset.html');
  assert.deepEqual(calls, [{ email: 'fan@example.com', options: { redirectTo: 'https://example.test/reset.html' } }]);
});

test('requestPasswordReset rejects invalid email or missing recovery URL', async () => {
  const client = { auth: { async resetPasswordForEmail() { throw new Error('must not be called'); } } };
  await assert.rejects(() => requestPasswordReset(client, '', 'https://example.test/reset.html'), /valid email/);
  await assert.rejects(() => requestPasswordReset(client, 'fan@example.com', ''), /recovery URL/);
});

test('resetPassword validates confirmation and delegates the new password', async () => {
  const calls = [];
  const client = { auth: { async updateUser(payload) { calls.push(payload); return { data: { user: { id: 'u1' } }, error: null }; } } };
  await resetPassword(client, 'new-secret', 'new-secret');
  assert.deepEqual(calls, [{ password: 'new-secret' }]);
  await assert.rejects(() => resetPassword(client, 'short', 'short'), /at least 6/);
  await assert.rejects(() => resetPassword(client, 'new-secret', 'different'), /do not match/);
});
