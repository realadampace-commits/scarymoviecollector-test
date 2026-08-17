import { getSupabaseClient } from '../supabase-client.js';
import { requireSession } from '../auth.js';
import { listMyOrders } from '../data/orders.js';
import { escapeHtml, formatUsd } from '../ui.js';

const client = getSupabaseClient();
const session = await requireSession(client, 'orders.html');
const status = document.getElementById('status');
const buyList = document.getElementById('buyList');
const sellList = document.getElementById('sellList');
const buyEmpty = document.getElementById('buyEmpty');
const sellEmpty = document.getElementById('sellEmpty');
const buyPane = document.getElementById('buyPane');
const sellPane = document.getElementById('sellPane');
const tabBuy = document.getElementById('tabBuy');
const tabSell = document.getElementById('tabSell');

function render(rows, userId, target, empty) {
  empty.style.display = rows.length ? 'none' : 'block';
  target.innerHTML = rows.map((row) => `<div class="order">
    <div class="row"><strong>${row.buyer_id === userId ? 'Purchase' : 'Sale'}</strong><span class="pill ${escapeHtml(row.status || 'pending')}">${escapeHtml(row.status || 'pending')}</span></div>
    <div><a href="item.html?id=${encodeURIComponent(row.item_id)}">View item</a></div>
    <div class="row"><span>${formatUsd(Number(row.price_usdc || 0) / 1_000_000)} ${escapeHtml(row.currency || 'USDC')}</span><span class="small">${escapeHtml(new Date(row.created_at).toLocaleString())}</span></div>
    <div class="small muted">${row.status === 'pending' ? 'Payment verification is pending. No settlement is performed in the browser.' : row.tx_hash ? 'Transaction recorded by the authorized payment flow.' : 'No transaction reference.'}</div>
    ${row.tracking_number ? `<div class="small">Tracking: ${escapeHtml(row.tracking_number)}</div>` : ''}
  </div>`).join('');
}

function show(which) {
  const buying = which === 'buy';
  tabBuy.classList.toggle('active', buying);
  tabSell.classList.toggle('active', !buying);
  buyPane.style.display = buying ? 'block' : 'none';
  sellPane.style.display = buying ? 'none' : 'block';
}
tabBuy.addEventListener('click', () => show('buy'));
tabSell.addEventListener('click', () => show('sell'));

status.textContent = 'Loading…';
try {
  const rows = await listMyOrders(client, session.user.id);
  render(rows.filter((row) => row.buyer_id === session.user.id), session.user.id, buyList, buyEmpty);
  render(rows.filter((row) => row.seller_id === session.user.id), session.user.id, sellList, sellEmpty);
  status.textContent = '';
} catch (error) {
  status.textContent = error.message || 'Unable to load order history.';
}
