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
