const allowedMimeTypes = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);
const maxAvatarBytes = 5 * 1024 * 1024;

export function validateAvatarFile(file) {
  if (!file) throw new TypeError('an image is required');
  if (!allowedMimeTypes.has(file.type)) throw new TypeError('avatar must be a PNG, JPEG, WebP, or GIF image');
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > maxAvatarBytes) throw new TypeError('avatar must be 5 MB or smaller');
}

export function avatarObjectPath(ownerId, mimeType, now = Date.now()) {
  if (!ownerId || typeof ownerId !== 'string') throw new TypeError('owner id is required');
  const extension = allowedMimeTypes.get(mimeType);
  if (!extension) throw new TypeError('unsupported avatar image type');
  return `${ownerId}/avatar-${now}.${extension}`;
}

export async function uploadAvatar(client, ownerId, file) {
  validateAvatarFile(file);
  const path = avatarObjectPath(ownerId, file.type);
  const { error } = await client.storage.from('avatars').upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = client.storage.from('avatars').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('unable to create avatar URL');
  return data.publicUrl;
}
