import { getSupabaseClient } from '../supabase-client.js';
import { requireSession } from '../auth.js';
import { getItem } from '../data/items.js';
import { listItemImages } from '../data/item-images.js';
import { uploadOwnItemImages } from '../data/item-image-upload.js';
import { updateOwnItem } from '../data/item-edit.js';

const id = new URLSearchParams(location.search).get('id');
if (!id) { location.href = 'index.html'; throw new Error('missing item id'); }
const client = getSupabaseClient();
const session = await requireSession(client);
const item = await getItem(client, id);
if (!item) { document.getElementById('permNote').textContent = 'Item not found.'; throw new Error('item not found'); }
const owner = item.owner_id === session.user.id;
const title = document.getElementById('title');
const price = document.getElementById('price');
const desc = document.getElementById('desc');
title.value = item.title || ''; price.value = item.price ?? ''; desc.value = item.description || '';
document.getElementById('backLink').href = `item.html?id=${encodeURIComponent(id)}`;
const grid = document.getElementById('grid');
const newFiles = document.getElementById('newFiles');
const addBtn = document.getElementById('addBtn');
const imageMsg = document.getElementById('msg');
const capMsg = document.getElementById('capMsg');
const unsupported = ['sellToggle','sellPriceUsdc','saveSelling','soldPrice','markSold','undoSold'];
unsupported.forEach((key) => { const element = document.getElementById(key); if (element) element.disabled = true; });

let images = await listItemImages(client, id);
function renderImages() {
  grid.replaceChildren();
  for (const image of images) {
    const tile = document.createElement('div'); tile.className = 'tile';
    const img = document.createElement('img'); img.src = image.image_url; img.alt = `Item image ${image.position + 1}`;
    tile.append(img); grid.append(tile);
  }
  capMsg.textContent = `${images.length}/5 images`;
}
renderImages();
if (!owner) {
  newFiles.disabled = true; addBtn.disabled = true;
} else {
  addBtn.addEventListener('click', async () => {
    const files = Array.from(newFiles.files || []);
    if (!files.length) { imageMsg.textContent = 'Choose at least one image.'; return; }
    addBtn.disabled = true; imageMsg.textContent = 'Uploading…';
    try {
      await uploadOwnItemImages(client, id, session.user.id, files);
      images = await listItemImages(client, id); renderImages(); newFiles.value = ''; imageMsg.textContent = 'Uploaded.';
    } catch (error) { imageMsg.textContent = error.message || 'Unable to upload images.'; }
    finally { addBtn.disabled = false; }
  });
}
document.getElementById('permNote').textContent = owner ? 'Metadata and image editing enabled; sale controls are temporarily unavailable.' : 'View-only access.';
if (!owner) document.getElementById('saveDetails').disabled = true;
document.getElementById('saveDetails').addEventListener('click', async () => {
  const message = document.getElementById('detailsMsg');
  try { await updateOwnItem(client, id, session.user.id, { title: title.value.trim(), description: desc.value, price: Number(price.value) }); message.textContent = 'Saved.'; }
  catch (error) { message.textContent = error.message || 'Unable to save changes.'; }
});
