export async function listItemImages(client, itemId) {
  if (!itemId || typeof itemId !== 'string') throw new TypeError('item id is required');
  const { data, error } = await client
    .from('items_images')
    .select('id,item_id,image_url,position,created_at')
    .eq('item_id', itemId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function firstImage(images) {
  return (images ?? []).find((image) => image?.image_url)?.image_url ?? null;
}
