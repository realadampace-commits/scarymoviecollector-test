import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { getItemDetail } from '../data/item-detail.js';
import { deleteOwnItem } from '../data/items.js';

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
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlayImg');
const previousButton = document.getElementById('prevBtn');
const nextButton = document.getElementById('nextBtn');
const closeButton = document.getElementById('closeBtn');

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
if (!images.length) {
  main.removeAttribute('role');
  main.removeAttribute('tabindex');
  main.removeAttribute('aria-label');
  main.classList.add('no-image');
}
let selectedIndex = 0;
const selectImage = (index) => {
  selectedIndex = (index + images.length) % images.length;
  thumbs.querySelectorAll('button').forEach((node, nodeIndex) => {
    node.classList.toggle('sel', nodeIndex === selectedIndex);
    node.setAttribute('aria-current', nodeIndex === selectedIndex ? 'true' : 'false');
  });
  showImage(images[selectedIndex]?.image_url);
};
thumbs.innerHTML = images.map((image, index) => `<button type="button" aria-label="View image ${index + 1} of ${images.length}" aria-current="${index === 0 ? 'true' : 'false'}" data-index="${index}" class="${index === 0 ? 'sel' : ''}"><img src="${escapeHtml(image.image_url)}" alt="" loading="lazy" decoding="async"></button>`).join('');
thumbs.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button) selectImage(Number(button.dataset.index));
});
const updateLightboxNavigation = () => {
  const hasMultipleImages = images.length > 1;
  previousButton.disabled = !hasMultipleImages;
  nextButton.disabled = !hasMultipleImages;
  previousButton.setAttribute('aria-hidden', String(!hasMultipleImages));
  nextButton.setAttribute('aria-hidden', String(!hasMultipleImages));
};
updateLightboxNavigation();
const openLightbox = () => {
  if (!images.length) return;
  overlayImg.src = images[selectedIndex].image_url;
  overlayImg.alt = `${item.title || 'Item'} image ${selectedIndex + 1} of ${images.length}`;
  overlay.style.display = 'block';
  closeButton.focus();
};
const closeLightbox = () => { overlay.style.display = 'none'; main.focus(); };
const lightboxButtons = () => [closeButton, previousButton, nextButton].filter((button) => !button.disabled);
const keepFocusInLightbox = (event) => {
  if (event.key !== 'Tab' || overlay.style.display !== 'block') return;
  const focusable = lightboxButtons();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
main.addEventListener('click', openLightbox);
main.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openLightbox(); } });
closeButton.addEventListener('click', closeLightbox);
previousButton.addEventListener('click', () => { selectImage(selectedIndex - 1); openLightbox(); });
nextButton.addEventListener('click', () => { selectImage(selectedIndex + 1); openLightbox(); });
overlay.addEventListener('click', (event) => { if (event.target === overlay) closeLightbox(); });
document.addEventListener('keydown', (event) => {
  if (overlay.style.display !== 'block') return;
  keepFocusInLightbox(event);
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') previousButton.click();
  if (event.key === 'ArrowRight') nextButton.click();
});

agg.textContent = `Agree: ${votes.agree} • Disagree: ${votes.disagree}`;
const total = votes.agree + votes.disagree;
fill.style.width = `${total ? (votes.agree / total) * 100 : 0}%`;
avg.textContent = `Average suggested: ${votes.averageSuggested == null ? '—' : formatUsd(votes.averageSuggested)}`;

const session = await getSession(client);
if (session) voteBox.style.display = '';
else {
  guest.style.display = '';
  document.getElementById('loginLink').href = `login.html?next=${encodeURIComponent(`item.html?id=${encodeURIComponent(id)}`)}`;
}


if (session?.user?.id === item.owner_id) {
  const ownerTools = document.getElementById('ownerTools');
  const deleteButton = document.getElementById('deleteBtn');
  const deleteMsg = document.getElementById('deleteMsg');
  ownerTools.style.display = 'flex';
  document.getElementById('editBtn').href = `edit.html?id=${encodeURIComponent(item.id)}`;
  deleteButton.addEventListener('click', async () => {
    if (!confirm('Delete this item?')) return;
    deleteButton.disabled = true;
    deleteMsg.textContent = 'Deleting item…';
    try {
      await deleteOwnItem(client, item.id, session.user.id);
      location.href = 'portfolio.html';
    } catch (error) {
      deleteButton.disabled = false;
      deleteMsg.textContent = error.message || 'Unable to delete item. Try again.';
    }
  });
}

let choice = null;
const agreeButton = document.getElementById('agreeBtn');
const disagreeButton = document.getElementById('disagreeBtn');
const setChoice = (agree) => {
  choice = agree;
  agreeButton.classList.toggle('active', agree);
  disagreeButton.classList.toggle('active', !agree);
  agreeButton.setAttribute('aria-pressed', String(agree));
  disagreeButton.setAttribute('aria-pressed', String(!agree));
  document.getElementById('disagreeBlock').style.display = agree ? 'none' : 'flex';
};
agreeButton.addEventListener('click', () => setChoice(true));
disagreeButton.addEventListener('click', () => setChoice(false));
const saveSuggestionButton = document.getElementById('saveSuggestion');
saveSuggestionButton.addEventListener('click', async () => {
  if (choice === null || !session) { voteMsg.textContent = 'Choose a vote first.'; return; }
  saveSuggestionButton.disabled = true;
  voteMsg.textContent = 'Saving vote…';
  try {
    await saveItemVote(client, { itemId: id, voterId: session.user.id, agree: choice, suggestedPrice: document.getElementById('suggestPrice').value });
    voteMsg.textContent = 'Vote saved.';
  } catch (error) { voteMsg.textContent = error.message || 'Unable to save vote.'; }
  finally { saveSuggestionButton.disabled = false; }
});
