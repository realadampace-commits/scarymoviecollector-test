export async function listRecentItems(client, { limit = 24 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
  const { data, error } = await client
    .from('items')
    .select('id,owner_id,title,description,user_value,image_url,created_at,is_for_sale,sold,items_images(image_url,position,created_at)')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return (data ?? []).map((item) => ({
    ...item,
    image_url: item.image_url || item.items_images?.toSorted((a, b) => (
      (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
    ))[0]?.image_url || null,
  }));
}

export async function getItem(client, id) {
  if (!id || typeof id !== 'string') throw new TypeError('item id is required');
  const { data, error } = await client
    .from('items')
    .select('id,owner_id,title,description,user_value,image_url,created_at,is_for_sale,sold')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteOwnItem(client, itemId, ownerId) {
  if (!itemId || !ownerId || typeof itemId !== 'string' || typeof ownerId !== 'string') {
    throw new TypeError('item and owner ids are required');
  }
  const { data, error } = await client
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('owner_id', ownerId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('owned item was not deleted');
}

export async function listPortfolioItems(client, ownerId) {
  if (!ownerId || typeof ownerId !== 'string') throw new TypeError('owner id is required');
  const { data, error } = await client
    .from('items')
    .select('id,title,user_value,created_at,owner_id,sold,profiles:owner_id(username,avatar_url)')
    .eq('owner_id', ownerId)
    .or('sold.is.null,sold.eq.false')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
