export async function listFrames(client) {
  const { data, error } = await client
    .from('frames')
    .select('id,title,image_url,scale,offset_x,offset_y')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function frameStyle(frame = {}) {
  return {
    '--frameScale': String(frame.scale ?? 1),
    '--frameX': `${frame.offset_x ?? 0}px`,
    '--frameY': `${frame.offset_y ?? 0}px`
  };
}
