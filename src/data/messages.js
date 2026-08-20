export function createRequestTracker() {
  let current = 0;
  return {
    start() { current += 1; return current; },
    current() { return current; },
    isCurrent(request) { return request === current; }
  };
}

export function getOtherParticipantId(thread, currentUserId) {
  const participants = Array.isArray(thread?.dm_participants) ? thread.dm_participants : [];
  if (!participants.some((participant) => participant?.user_id === currentUserId)) return null;
  return participants.find((participant) => participant?.user_id && participant.user_id !== currentUserId)?.user_id ?? null;
}

export async function createThread(client, otherUserId) {
  if (!otherUserId || typeof otherUserId !== 'string') throw new TypeError('other user id is required');
  const { data, error } = await client.rpc('create_dm_thread', { other_user: otherUserId });
  if (error) throw error;
  return data;
}

export async function listMyThreads(client) {
  const { data, error } = await client
    .from('dm_threads')
    .select('id,created_at,dm_participants!inner(user_id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listThreadMessages(client, threadId, { limit = 100 } = {}) {
  if (!threadId || typeof threadId !== 'string') throw new TypeError('thread id is required');
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const { data, error } = await client
    .from('dm_messages')
    .select('id,thread_id,author_id,body,created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(safeLimit);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(client, { threadId, authorId, body }) {
  if (!threadId || !authorId || !String(body ?? '').trim()) {
    throw new TypeError('thread, author, and body are required');
  }
  const { data, error } = await client
    .from('dm_messages')
    .insert({ thread_id: threadId, author_id: authorId, body: String(body).trim() })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
