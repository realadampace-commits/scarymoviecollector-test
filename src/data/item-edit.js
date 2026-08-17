export async function updateOwnItem(client, itemId, ownerId, patch) {
  if (!itemId || !ownerId || typeof itemId !== 'string' || typeof ownerId !== 'string') throw new TypeError('item and owner ids are required');
  const allowed = ['title', 'description', 'price'];
  const update = Object.fromEntries(Object.entries(patch ?? {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(update).length) throw new TypeError('no editable fields supplied');
  const { data, error } = await client.from('items').update(update).eq('id', itemId).eq('owner_id', ownerId).select('id,title,description,price').maybeSingle();
  if (error) throw error;
  return data;
}

