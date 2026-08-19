const allowedMimeTypes = new Map([
  ['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp'], ['image/gif', 'gif'],
]);
const maxFrameBytes = 10 * 1024 * 1024;

export function frameStyle(frame = {}) {
  return {
    '--frameScale': String(frame.scale ?? 1),
    '--frameX': `${frame.offset_x ?? 0}px`,
    '--frameY': `${frame.offset_y ?? 0}px`
  };
}

export async function listFrames(client) {
  const { data, error } = await client.from('frames')
    .select('id,title,image_url,scale,offset_x,offset_y')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function validateFrameFile(file) {
  if (!file) throw new TypeError('an image is required');
  if (!allowedMimeTypes.has(file.type)) throw new TypeError('frame must be a PNG, JPEG, WebP, or GIF image');
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > maxFrameBytes) throw new TypeError('frame must be 10 MB or smaller');
}

export async function createFrame(client, ownerId, file, { title = '', scale = 1 } = {}) {
  validateFrameFile(file);
  const numericScale = Number(scale);
  if (!Number.isFinite(numericScale) || numericScale < 0.5 || numericScale > 2) throw new TypeError('scale must be between 0.5 and 2');
  const extension = allowedMimeTypes.get(file.type);
  const path = `${ownerId}/frame-${Date.now()}.${extension}`;
  const { error: uploadError } = await client.storage.from('frames').upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data: urlData } = client.storage.from('frames').getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('unable to create frame URL');
  const { data, error } = await client.from('frames').insert({ title: String(title).trim() || null, image_url: urlData.publicUrl, created_by: ownerId, scale: numericScale }).select().single();
  if (error) throw error;
  return data;
}
