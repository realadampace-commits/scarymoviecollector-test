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
