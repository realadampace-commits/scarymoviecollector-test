const MODEL_EXTENSIONS = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl']);
const COMPANION_EXTENSIONS = new Set(['mtl', 'bin', 'png', 'jpg', 'jpeg', 'webp']);
const MAX_PACKAGE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 30;
const MAX_STORAGE_OBJECT_BYTES = 45 * 1024 * 1024;

function extension(name) {
  return String(name || '').split('.').pop()?.toLowerCase() || '';
}

function safeName(name) {
  return String(name || '').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_');
}

function uploadContentType(file) {
  const ext = extension(file.name);
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gltf') return 'model/gltf+json';
  if (ext === 'glb') return 'model/gltf-binary';
  return 'application/octet-stream';
}

export function validateModelPackage(files) {
  const selected = Array.from(files || []);
  if (!selected.length) throw new TypeError('Choose a 3D model and any texture files.');
  if (selected.length > MAX_FILES) throw new TypeError(`A model package can contain at most ${MAX_FILES} files.`);
  const unsupported = selected.find((file) => !MODEL_EXTENSIONS.has(extension(file.name)) && !COMPANION_EXTENSIONS.has(extension(file.name)));
  if (unsupported) throw new TypeError(`${unsupported.name} is not a supported model, material, or texture file.`);
  const models = selected.filter((file) => MODEL_EXTENSIONS.has(extension(file.name)));
  if (models.length !== 1) throw new TypeError('Select exactly one primary 3D model file.');
  const totalBytes = selected.reduce((total, file) => total + Number(file.size || 0), 0);
  if (totalBytes > MAX_PACKAGE_BYTES) throw new TypeError('The complete 3D model package must be 100 MB or smaller.');
  const names = selected.map((file) => safeName(file.name).toLowerCase());
  if (new Set(names).size !== names.length) throw new TypeError('Each uploaded file must have a unique filename.');
  return { files: selected, primary: models[0], format: extension(models[0].name), totalBytes };
}

export async function getItemModel(client, itemId) {
  const { data, error } = await client.from('item_models').select('item_id,owner_id,model_url,model_format,files,created_at,updated_at').eq('item_id', itemId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function uploadOwnItemModel(client, itemId, ownerId, files) {
  if (![itemId, ownerId].every((value) => typeof value === 'string' && value)) throw new TypeError('item and owner ids are required');
  const plan = validateModelPackage(files);
  const { data: item, error: itemError } = await client.from('items').select('id').eq('id', itemId).eq('owner_id', ownerId).maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error('item ownership could not be verified');

  const previous = await getItemModel(client, itemId);
  const packageId = crypto.randomUUID();
  const uploadedPaths = [];
  try {
    const manifest = [];
    for (const file of plan.files) {
      const name = safeName(file.name);
      const type = uploadContentType(file);
      const partCount = Math.max(1, Math.ceil(Number(file.size || 0) / MAX_STORAGE_OBJECT_BYTES));
      const parts = [];
      for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
        const suffix = partCount === 1 ? '' : `.part-${String(partIndex + 1).padStart(3, '0')}`;
        const path = `${ownerId}/${itemId}/${packageId}/${name}${suffix}`;
        const body = partCount === 1 ? file : file.slice(partIndex * MAX_STORAGE_OBJECT_BYTES, Math.min((partIndex + 1) * MAX_STORAGE_OBJECT_BYTES, file.size), type);
        const { error } = await client.storage.from('item-models').upload(path, body, { contentType: type, upsert: false });
        if (error) throw error;
        uploadedPaths.push(path);
        const { data } = client.storage.from('item-models').getPublicUrl(path);
        parts.push({ path, url: data.publicUrl, size: Number(body.size || 0) });
      }
      manifest.push({
        name,
        type,
        size: Number(file.size || 0),
        ...(parts.length === 1 ? parts[0] : { parts })
      });
    }
    const primaryName = safeName(plan.primary.name);
    const primary = manifest.find((file) => file.name === primaryName);
    const { error } = await client.from('item_models').upsert({
      item_id: itemId,
      owner_id: ownerId,
      model_url: primary.url || primary.parts[0].url,
      model_format: plan.format,
      files: manifest,
      updated_at: new Date().toISOString()
    }, { onConflict: 'item_id' });
    if (error) throw error;
    const oldPaths = Array.isArray(previous?.files) ? previous.files.flatMap((file) => file.parts?.map((part) => part.path) || [file.path]).filter(Boolean) : [];
    if (oldPaths.length) await client.storage.from('item-models').remove(oldPaths);
    return { model_url: primary.url || primary.parts[0].url, model_format: plan.format, files: manifest };
  } catch (error) {
    if (uploadedPaths.length) await client.storage.from('item-models').remove(uploadedPaths);
    throw error;
  }
}

export async function deleteOwnItemModel(client, itemId, ownerId) {
  const model = await getItemModel(client, itemId);
  if (!model || model.owner_id !== ownerId) throw new Error('item model ownership could not be verified');
  const { error } = await client.from('item_models').delete().eq('item_id', itemId).eq('owner_id', ownerId);
  if (error) throw error;
  const paths = Array.isArray(model.files) ? model.files.flatMap((file) => file.parts?.map((part) => part.path) || [file.path]).filter(Boolean) : [];
  if (paths.length) await client.storage.from('item-models').remove(paths);
}
