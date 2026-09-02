import { getSupabaseClient } from '../supabase-client.js';
import { requireSession } from '../auth.js';
import { getItem } from '../data/items.js';
import { listItemImages } from '../data/item-images.js';
import { uploadOwnItemImages } from '../data/item-image-upload.js';
import { updateOwnItem } from '../data/item-edit.js';

const id = new URLSearchParams(location.search).get('id');
if (!id) { location.href = 'index.html'; throw new Error('missing item id'); }
let client;
let session;
try {
  client = getSupabaseClient();
  session = await requireSession(client);
} catch {
  location.replace(`login.html?next=${encodeURIComponent(`edit.html?id=${id}`)}`);
}
if (session) {
const item = await getItem(client, id);
if (!item) { document.getElementById('permNote').textContent = 'Item not found.'; throw new Error('item not found'); }
const owner = item.owner_id === session.user.id;
const title = document.getElementById('title');
const price = document.getElementById('price');
const desc = document.getElementById('desc');
title.value = item.title || ''; price.value = item.user_value ?? ''; desc.value = item.description || '';
document.getElementById('backLink').href = `item.html?id=${encodeURIComponent(id)}`;
const grid = document.getElementById('grid');
const newFiles = document.getElementById('newFiles');
const addBtn = document.getElementById('addBtn');
const imageMsg = document.getElementById('msg');
const capMsg = document.getElementById('capMsg');
const sellToggle = document.getElementById('sellToggle');
const saveSelling = document.getElementById('saveSelling');
const soldPrice = document.getElementById('soldPrice');
const markSold = document.getElementById('markSold');
const undoSold = document.getElementById('undoSold');
sellToggle.checked = Boolean(item.is_for_sale);
soldPrice.value = item.sold_price ?? '';
if (item.sold) { soldPrice.disabled = true; markSold.style.display = 'none'; undoSold.style.display = ''; }
if (!owner) [sellToggle, saveSelling, soldPrice, markSold, undoSold].forEach((element) => { element.disabled = true; });
saveSelling.addEventListener('click', async () => {
  saveSelling.disabled = true;
  try { await updateOwnItem(client, id, session.user.id, { is_for_sale: sellToggle.checked }); document.getElementById('sellNote').textContent = 'Sale status saved.'; }
  catch (error) { document.getElementById('sellNote').textContent = error.message || 'Unable to save sale status.'; }
  finally { saveSelling.disabled = false; }
});
markSold.addEventListener('click', async () => {
  markSold.disabled = true;
  try { await updateOwnItem(client, id, session.user.id, { sold: true, is_for_sale: false, sold_price: Number(soldPrice.value) || 0, sold_at: new Date().toISOString() }); location.reload(); }
  catch (error) { document.getElementById('soldMsg').textContent = error.message || 'Unable to mark sold.'; markSold.disabled = false; }
});
undoSold.addEventListener('click', async () => {
  undoSold.disabled = true;
  try { await updateOwnItem(client, id, session.user.id, { sold: false, sold_price: null, sold_at: null }); location.reload(); }
  catch (error) { document.getElementById('soldMsg').textContent = error.message || 'Unable to undo sale.'; undoSold.disabled = false; }
});

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
    addBtn.disabled = true; addBtn.setAttribute('aria-busy', 'true'); imageMsg.textContent = 'Uploading…';
    try {
      await uploadOwnItemImages(client, id, session.user.id, files);
      images = await listItemImages(client, id); renderImages(); newFiles.value = ''; imageMsg.textContent = 'Uploaded.';
    } catch (error) { imageMsg.textContent = error.message || 'Unable to upload images.'; }
    finally { addBtn.disabled = false; addBtn.removeAttribute('aria-busy'); }
  });
}
document.getElementById('permNote').textContent = owner ? 'Metadata and image editing enabled; sale controls are temporarily unavailable.' : 'View-only access.';
if (!owner) document.getElementById('saveDetails').disabled = true;
document.getElementById('saveDetails').addEventListener('click', async () => {
  const message = document.getElementById('detailsMsg');
  const saveButton = document.getElementById('saveDetails');
  if (saveButton.disabled) return;
  saveButton.disabled = true; saveButton.setAttribute('aria-busy', 'true'); message.textContent = 'Saving…';
  try { await updateOwnItem(client, id, session.user.id, { title: title.value.trim(), description: desc.value, user_value: Number(price.value) }); message.textContent = 'Saved.'; }
  catch (error) { message.textContent = error.message || 'Unable to save changes. Try again.'; }
  finally { saveButton.disabled = false; saveButton.removeAttribute('aria-busy'); }
});
}
