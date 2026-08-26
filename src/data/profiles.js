export async function searchProfiles(client, query, { limit = 50 } = {}) {
  const term = String(query ?? '').trim();
  if (!term) return [];
  const literalTerm = term.replace(/[\\%_]/g, '\\$&');
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { data, error } = await client
    .from('profiles')
    .select('id,username,role')
    .ilike('username', `%${literalTerm}%`)
    .order('username', { ascending: true })
    .limit(safeLimit);
  if (error) throw error;
  return data ?? [];
}

export async function getProfile(client, id) {
  if (!id || typeof id !== 'string') throw new TypeError('profile id is required');
  const { data, error } = await client
    .from('profiles')
    .select('id,username,created_at,avatar_url,bio,showcase_ids,role,frame_url,frame_scale,post_count,reply_count,frame_offset_x,frame_offset_y')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateOwnProfile(client, id, patch) {
  if (!id || typeof id !== 'string') throw new TypeError('profile id is required');
  const allowed = ['username', 'avatar_url', 'bio', 'showcase_ids', 'frame_url', 'frame_scale', 'frame_offset_x', 'frame_offset_y'];
  const update = Object.fromEntries(Object.entries(patch ?? {}).filter(([key]) => allowed.includes(key)));
  const { data, error } = await client.from('profiles').update(update).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data;
}
