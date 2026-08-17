export async function signUpWithPassword(client, email, password) {
  if (!String(email ?? '').trim() || String(password ?? '').length < 6) throw new TypeError('valid email and password are required');
  const { data, error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(client, email, password) {
  if (!String(email ?? '').trim() || !password) throw new TypeError('email and password are required');
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function getSession(client) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

export async function requireSession(client) {
  const session = await getSession(client);
  if (!session) throw new Error('authentication required');
  return session;
}

export async function signOut(client) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
