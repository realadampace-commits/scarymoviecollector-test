import { getSupabaseClient } from '../supabase-client.js';
import { requireSession } from '../auth.js';
import { listMyOrders } from '../data/orders.js';
import { escapeHtml, formatDate, formatUsd } from '../ui.js';

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

function updateTabCount(tab, count) {
  const label = tab.dataset.tabLabel;
  tab.querySelector('.tab-count').textContent = String(count);
  tab.setAttribute('aria-label', `${label}, ${count} ${count === 1 ? 'order' : 'orders'}`);
}

function render(rows, userId, target, empty) {
  empty.style.display = rows.length ? 'none' : 'block';
  target.innerHTML = rows.map((row) => `<div class="order">
    <div class="row"><strong>${row.buyer_id === userId ? 'Purchase' : 'Sale'}</strong><span class="pill ${escapeHtml(row.status || 'pending')}">${escapeHtml(row.status || 'pending')}</span></div>
    <div><a href="item.html?id=${encodeURIComponent(row.item_id)}">${escapeHtml(row.items?.title || 'View item')}</a></div>
    <div class="row"><span>${formatUsd(Number(row.price_usdc || 0) / 1_000_000)} ${escapeHtml(row.currency || 'USDC')}</span><span class="small">${escapeHtml(formatDate(row.created_at))}</span></div>
    <div class="small muted">${row.status === 'pending' ? 'Payment verification is pending. No settlement is performed in the browser.' : row.status === 'paid' ? 'Payment verified by the authorized payment flow; shipping updates are server-controlled.' : row.status === 'shipped' ? 'Seller marked this order shipped. Delivery confirmation is server-controlled.' : row.status === 'completed' ? 'Order completed by the authorized marketplace flow.' : row.tx_hash ? 'Transaction recorded by the authorized payment flow.' : 'No transaction reference. This history is read-only.'}</div>
    ${row.tracking_number ? `<div class="small">Tracking: ${escapeHtml(row.tracking_number)}</div>` : ''}
  </div>`).join('');
}

function show(which, moveFocus = false) {
  const buying = which === 'buy';
  tabBuy.classList.toggle('active', buying);
  tabSell.classList.toggle('active', !buying);
  tabBuy.setAttribute('aria-selected', String(buying));
  tabSell.setAttribute('aria-selected', String(!buying));
  tabBuy.tabIndex = buying ? 0 : -1;
  tabSell.tabIndex = buying ? -1 : 0;
  buyPane.hidden = !buying;
  sellPane.hidden = buying;
  if (moveFocus) (buying ? tabBuy : tabSell).focus();
}

function moveTab(event) {
  const tabs = [tabBuy, tabSell];
  const current = tabs.indexOf(event.currentTarget);
  let next;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  show(next === 0 ? 'buy' : 'sell', true);
}

tabBuy.addEventListener('click', () => show('buy'));
tabSell.addEventListener('click', () => show('sell'));
tabBuy.addEventListener('keydown', moveTab);
tabSell.addEventListener('keydown', moveTab);
show('buy');

async function loadOrders() {
  status.textContent = 'Loading…';
  try {
    const rows = await listMyOrders(client, session.user.id);
    const buying = rows.filter((row) => row.buyer_id === session.user.id);
    const selling = rows.filter((row) => row.seller_id === session.user.id);
    updateTabCount(tabBuy, buying.length);
    updateTabCount(tabSell, selling.length);
    render(buying, session.user.id, buyList, buyEmpty);
    render(selling, session.user.id, sellList, sellEmpty);
    status.textContent = '';
    buyList.setAttribute('aria-busy', 'false');
    sellList.setAttribute('aria-busy', 'false');
  } catch (error) {
    status.innerHTML = `${escapeHtml(error.message || 'Unable to load order history.')} <button class="retry-orders" type="button">Retry loading orders</button>`;
    status.querySelector('.retry-orders')?.addEventListener('click', loadOrders, { once: true });
  }
}

loadOrders();
