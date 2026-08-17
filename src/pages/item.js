import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { getItemDetail } from '../data/item-detail.js';
import { deleteOwnItem } from '../data/items.js';
import { createOrderIntent } from '../data/order-intent.js';
import { saveItemVote } from '../data/item-votes.js';
import { escapeHtml, formatUsd } from '../ui.js';

const client = getSupabaseClient();
const id = new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('itemId');
const title = document.getElementById('itemTitle');
const meta = document.getElementById('metaLine');
const desc = document.getElementById('desc');
const price = document.getElementById('price');
const sale = document.getElementById('saleLine');
const created = document.getElementById('createdAt');
const main = document.getElementById('mainImg');
const thumbs = document.getElementById('thumbs');
const agg = document.getElementById('aggText');
const avg = document.getElementById('avgLine');
const fill = document.getElementById('agreeFill');
const voteBox = document.getElementById('voteBox');
const guest = document.getElementById('guestMsg');
const voteMsg = document.getElementById('voteMsg');

if (!id) { title.textContent = 'Item not found'; throw new Error('missing item id'); }
const detail = await getItemDetail(client, id);
if (!detail) { title.textContent = 'Item not found'; throw new Error('item not found'); }

const { item, owner, images, votes } = detail;
title.textContent = item.title || 'Untitled item';
meta.textContent = owner?.username ? `Owned by @${owner.username}` : '';
desc.textContent = item.description || 'No description.';
price.textContent = formatUsd(item.user_value);
sale.textContent = item.sold ? 'Sold' : item.is_for_sale ? 'Available for sale' : 'Not listed for sale';
created.textContent = item.created_at ? `Added ${new Date(item.created_at).toLocaleDateString()}` : '';

function showImage(url) {
  main.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(item.title || '')}">` : 'No image';
}
showImage(images[0]?.image_url);
thumbs.innerHTML = images.map((image, index) => `<img src="${escapeHtml(image.image_url)}" alt="" data-index="${index}" class="${index === 0 ? 'sel' : ''}">`).join('');
thumbs.addEventListener('click', (event) => {
  const image = event.target.closest('img');
  if (!image) return;
  thumbs.querySelectorAll('img').forEach((node) => node.classList.remove('sel'));
  image.classList.add('sel');
  showImage(images[Number(image.dataset.index)]?.image_url);
});

agg.textContent = `Agree: ${votes.agree} • Disagree: ${votes.disagree}`;
const total = votes.agree + votes.disagree;
fill.style.width = `${total ? (votes.agree / total) * 100 : 0}%`;
avg.textContent = `Average suggested: ${votes.averageSuggested == null ? '—' : formatUsd(votes.averageSuggested)}`;

const session = await getSession(client);
if (session) voteBox.style.display = '';
else guest.style.display = '';

if (session && session.user.id !== item.owner_id && !item.sold && item.is_for_sale) {
  const buyCard = document.getElementById('buyCard');
  const buyButton = document.getElementById('buyBtn');
  const buyMsg = document.getElementById('buyMsg');
  buyCard.style.display = '';
  buyButton.addEventListener('click', async () => {
    buyButton.disabled = true;
    buyMsg.textContent = 'Preparing order…';
    try {
      const order = await createOrderIntent(client, {
        itemId: item.id,
        buyerId: session.user.id,
        sellerId: item.owner_id,
        priceUsdc: item.price_usdc ?? item.user_value
      });
      buyMsg.textContent = `Order ${order.id} is pending payment verification.`;
    } catch (error) {
      buyButton.disabled = false;
      buyMsg.textContent = error.message || 'Unable to prepare order.';
    }
  });
}

if (session?.user?.id === item.owner_id) {
  const ownerTools = document.getElementById('ownerTools');
  const deleteButton = document.getElementById('deleteBtn');
  ownerTools.style.display = 'flex';
  document.getElementById('editBtn').href = `edit.html?id=${encodeURIComponent(item.id)}`;
  deleteButton.addEventListener('click', async () => {
    if (!confirm('Delete this item?')) return;
    deleteButton.disabled = true;
    try {
      await deleteOwnItem(client, item.id, session.user.id);
      location.href = 'portfolio.html';
    } catch (error) {
      deleteButton.disabled = false;
      alert(error.message || 'Unable to delete item.');
    }
  });
}

let choice = null;
document.getElementById('agreeBtn').addEventListener('click', () => { choice = true; document.getElementById('agreeBtn').classList.add('active'); document.getElementById('disagreeBtn').classList.remove('active'); document.getElementById('disagreeBlock').style.display = 'none'; });
document.getElementById('disagreeBtn').addEventListener('click', () => { choice = false; document.getElementById('disagreeBtn').classList.add('active'); document.getElementById('agreeBtn').classList.remove('active'); document.getElementById('disagreeBlock').style.display = 'flex'; });
document.getElementById('saveSuggestion').addEventListener('click', async () => {
  if (choice === null || !session) { voteMsg.textContent = 'Choose a vote first.'; return; }
  try {
    await saveItemVote(client, { itemId: id, voterId: session.user.id, agree: choice, suggestedPrice: document.getElementById('suggestPrice').value });
    voteMsg.textContent = 'Vote saved.';
  } catch (error) { voteMsg.textContent = error.message || 'Unable to save vote.'; }
});
