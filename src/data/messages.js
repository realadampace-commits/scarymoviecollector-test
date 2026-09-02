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
  const [threadsResult, hiddenResult] = await Promise.all([
    client.from('dm_threads').select('id,created_at,dm_participants!inner(user_id)').order('created_at', { ascending: false }),
    client.from('dm_thread_hidden').select('thread_id')
  ]);
  if (threadsResult.error) throw threadsResult.error;
  if (hiddenResult.error) throw hiddenResult.error;
  const hidden = new Set((hiddenResult.data ?? []).map((row) => row.thread_id));
  return (threadsResult.data ?? []).filter((thread) => !hidden.has(thread.id));
}

export async function hideThreadForUser(client, { threadId, userId } = {}) {
  if (!threadId || !userId) throw new TypeError('thread and user ids are required');
  const { error } = await client.from('dm_thread_hidden').upsert({ thread_id: threadId, user_id: userId }, { onConflict: 'thread_id,user_id' });
  if (error) throw error;
}

export async function deleteThreadForEveryone(client, threadId) {
  if (!threadId || typeof threadId !== 'string') throw new TypeError('thread id is required');
  const { data, error } = await client.rpc('delete_dm_thread_for_all', { target_thread: threadId });
  if (error) throw error;
  if (!data) throw new Error('thread was not deleted');
  return data;
}

export async function listThreadMessages(client, threadId, { limit = 100 } = {}) {
  if (!threadId || typeof threadId !== 'string') throw new TypeError('thread id is required');
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const { data, error } = await client
    .from('dm_messages')
    .select('id,thread_id,author_id,body,created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return [...(data ?? [])].reverse();
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
  if (!data) throw new Error('message was not sent');
  return data;
}
