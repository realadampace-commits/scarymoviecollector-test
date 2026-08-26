import { validateImageUploadPlan } from './item-image-writes.js';

export async function uploadOwnItemImages(client, itemId, ownerId, files) {
  if (![itemId, ownerId].every((value) => typeof value === 'string' && value)) throw new TypeError('item and owner ids are required');
  const { data: item, error: itemError } = await client.from('items').select('id').eq('id', itemId).eq('owner_id', ownerId).maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error('item ownership could not be verified');
  const { count, error: countError } = await client.from('items_images').select('id', { count: 'exact', head: true }).eq('item_id', itemId);
  if (countError) throw countError;
  const plan = validateImageUploadPlan(count ?? 0, files);
  const uploaded = [];
  const uploadedUrls = [];
  try {
    for (const [index, file] of files.entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `items/${ownerId}/${itemId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await client.storage.from('item-images').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded.push(path);
      const { data: publicData } = client.storage.from('item-images').getPublicUrl(path);
      uploadedUrls.push(publicData.publicUrl);
      const { error: rowError } = await client.from('items_images').insert({ item_id: itemId, image_url: publicData.publicUrl, position: (count ?? 0) + index });
      if (rowError) throw rowError;
    }
    return plan;
  } catch (error) {
    await Promise.allSettled([
      client.from('items_images').delete().eq('item_id', itemId).in('image_url', uploadedUrls),
      ...uploaded.map((path) => client.storage.from('item-images').remove([path]))
    ]);
    throw error;
  }
}
