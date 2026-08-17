const immutableOrderFields = new Set([
  'item_id', 'buyer_id', 'seller_id', 'price_usdc', 'currency', 'method', 'tx_hash', 'chain_id'
]);

export async function listMyOrders(client, userId) {
  if (!userId || typeof userId !== 'string') throw new TypeError('user id is required');
  const { data, error } = await client
    .from('orders')
    .select('id,item_id,buyer_id,seller_id,price_usdc,currency,method,tx_hash,chain_id,status,tracking_number,created_at')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateOrder(client, orderId, patch) {
  if (!orderId || typeof orderId !== 'string') throw new TypeError('order id is required');
  const safePatch = Object.fromEntries(
    Object.entries(patch ?? {}).filter(([key]) => !immutableOrderFields.has(key))
  );
  const { data, error } = await client
    .from('orders')
    .update(safePatch)
    .eq('id', orderId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
