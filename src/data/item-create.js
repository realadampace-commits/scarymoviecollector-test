import { uploadOwnItemImages } from './item-image-upload.js';

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

export async function createOwnItem(client, ownerId, { title, description = '', userValue, files = [] } = {}) {
  if (!ownerId || typeof ownerId !== 'string') throw new TypeError('owner id is required');
  const cleanTitle = requiredText(title, 'title');
  const value = Number(userValue);
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) throw new TypeError('value must be a non-negative whole number');
  const selectedFiles = Array.from(files).slice(0, 5);
  const { data: item, error } = await client
    .from('items')
    .insert({ owner_id: ownerId, title: cleanTitle, description: String(description ?? '').trim() || null, user_value: value })
    .select('id')
    .single();
  if (error) throw error;
  try {
    if (selectedFiles.length) await uploadOwnItemImages(client, item.id, ownerId, selectedFiles);
    return item;
  } catch (uploadError) {
    try {
      await client.from('items').delete().eq('id', item.id).eq('owner_id', ownerId);
    } catch {
      // Preserve the actionable upload failure even if best-effort rollback also fails.
    }
    throw uploadError;
  }
}
