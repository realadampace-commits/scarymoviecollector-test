export function buildOrderIntent({ itemId, buyerId, sellerId, priceUsdc }) {
  if (!itemId || !buyerId || !sellerId) throw new TypeError('item, buyer, and seller are required');
  const price = Number(priceUsdc);
  if (!Number.isSafeInteger(price) || price <= 0) throw new TypeError('price must be a positive integer in USDC base units');
  if (buyerId === sellerId) throw new TypeError('buyer and seller must differ');
  return {
    item_id: itemId,
    buyer_id: buyerId,
    seller_id: sellerId,
    price_usdc: price,
    currency: 'USDC',
    method: 'USDC_BASE'
  };
}

export async function createOrderIntent(client, input) {
  const intent = buildOrderIntent(input);
  const { data, error } = await client
    .from('orders')
    .insert({ ...intent, status: 'pending' })
    .select('id,item_id,buyer_id,seller_id,price_usdc,currency,method,status,created_at')
    .maybeSingle();
  if (error) throw error;
  return data;
}
