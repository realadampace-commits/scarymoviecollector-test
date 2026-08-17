export async function listRecentItems(client, { limit = 24 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
  const { data, error } = await client
    .from('items')
    .select('id,owner_id,title,description,user_value,image_url,created_at,is_for_sale,price_usdc,sale_currency,sold')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return data ?? [];
}

export async function getItem(client, id) {
  if (!id || typeof id !== 'string') throw new TypeError('item id is required');
  const { data, error } = await client
    .from('items')
    .select('id,owner_id,title,description,user_value,image_url,created_at,is_for_sale,price_usdc,sale_currency,sold')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
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
