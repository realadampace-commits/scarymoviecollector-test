import { getSupabaseClient } from '../supabase-client.js';
import { requireSession } from '../auth.js';
import { getItem } from '../data/items.js';
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
const unsupported = ['grid','newFiles','addBtn','delBtn','sellToggle','sellPriceUsdc','saveSelling','soldPrice','markSold','undoSold'];
unsupported.forEach((key) => { const element = document.getElementById(key); if (element) element.disabled = true; });
document.getElementById('permNote').textContent = owner ? 'Metadata editing enabled; media and sale controls are temporarily unavailable.' : 'View-only access.';
if (!owner) document.getElementById('saveDetails').disabled = true;
document.getElementById('saveDetails').addEventListener('click', async () => {
  const message = document.getElementById('detailsMsg');
  try { await updateOwnItem(client, id, session.user.id, { title: title.value.trim(), description: desc.value, price: Number(price.value) }); message.textContent = 'Saved.'; }
  catch (error) { message.textContent = error.message || 'Unable to save changes.'; }
});
