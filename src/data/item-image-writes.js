export function validateImageUploadPlan(existingCount, files, maxImages = 5) {
  const current = Number(existingCount);
  if (!Number.isInteger(current) || current < 0) throw new TypeError('existing image count is invalid');
  if (!Array.isArray(files)) throw new TypeError('files must be an array');
  if (current + files.length > maxImages) throw new RangeError(`maximum ${maxImages} images allowed`);
  return files.map((file) => {
    if (!file || typeof file.name !== 'string' || !String(file.type).startsWith('image/')) throw new TypeError('only image files are allowed');
    return { name: file.name, type: file.type, size: Number(file.size) };
  });
}

export async function deleteOwnImage(client, imageId, itemId, ownerId) {
  if (![imageId, itemId, ownerId].every((value) => typeof value === 'string' && value)) throw new TypeError('image, item, and owner ids are required');
  const { data: ownedItem, error: ownerError } = await client.from('items').select('id').eq('id', itemId).eq('owner_id', ownerId).maybeSingle();
  if (ownerError) throw ownerError;
  if (!ownedItem) throw new Error('item ownership could not be verified');
  const { error } = await client.from('items_images').delete().eq('id', imageId).eq('item_id', itemId);
  if (error) throw error;
}
