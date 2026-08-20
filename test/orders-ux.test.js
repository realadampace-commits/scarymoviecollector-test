import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const html = fs.readFileSync(new URL('orders.html', root), 'utf8');
const script = fs.readFileSync(new URL('src/pages/orders.js', root), 'utf8');

test('order history tabs expose their state and panels to assistive technology', () => {
  assert.match(html, /role="tablist"/);
  assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="tabBuy"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="buyPane"/);
  assert.match(html, /id="tabSell"[^>]*role="tab"[^>]*aria-selected="false"[^>]*aria-controls="sellPane"/);
  assert.match(html, /id="buyPane"[^>]*role="tabpanel"[^>]*aria-labelledby="tabBuy"/);
  assert.match(html, /id="sellPane"[^>]*role="tabpanel"[^>]*aria-labelledby="tabSell"/);
});

test('switching order tabs keeps aria-selected synchronized with the visible pane', () => {
  assert.match(script, /tabBuy\.setAttribute\('aria-selected', String\(buying\)\)/);
  assert.match(script, /tabSell\.setAttribute\('aria-selected', String\(!buying\)\)/);
});

test('order tabs support roving focus and keyboard navigation', () => {
  assert.match(html, /id="tabBuy"[^>]*tabindex="0"/);
  assert.match(html, /id="tabSell"[^>]*tabindex="-1"/);
  assert.match(script, /tabBuy\.addEventListener\('keydown', moveTab\)/);
  assert.match(script, /tabSell\.addEventListener\('keydown', moveTab\)/);
  assert.match(script, /event\.key === 'ArrowRight'/);
  assert.match(script, /event\.key === 'Home'/);
  assert.match(script, /event\.preventDefault\(\)/);
  assert.match(script, /tabBuy\.tabIndex = buying \? 0 : -1/);
});

test('inactive order panel is hidden from assistive technology and tab switching updates hidden state', () => {
  assert.match(html, /id="sellPane"[^>]*role="tabpanel"[^>]*hidden/);
  assert.match(script, /buyPane\.hidden = !buying/);
  assert.match(script, /sellPane\.hidden = buying/);
});

test('order tabs summarize each history and expose the count accessibly', () => {
  assert.match(html, /id="tabBuy"[^>]*data-tab-label="Buying"[^>]*>Buying <span class="tab-count" aria-hidden="true">0<\/span>/);
  assert.match(html, /id="tabSell"[^>]*data-tab-label="Selling"[^>]*>Selling <span class="tab-count" aria-hidden="true">0<\/span>/);
  assert.match(script, /function updateTabCount\(tab, count\)/);
  assert.match(script, /tab\.setAttribute\('aria-label', `\$\{label\}, \$\{count\} \$\{count === 1 \? 'order' : 'orders'\}`\)/);
  assert.match(script, /updateTabCount\(tabBuy, buying\.length\)/);
  assert.match(script, /updateTabCount\(tabSell, selling\.length\)/);
});

test('order history explains that it is read-only until server actions are available', () => {
  assert.match(html, /Order history is read-only until server-verified shipping and receipt actions are available\./);
  assert.doesNotMatch(html, /Sellers can add a tracking number and mark as shipped/);
  assert.doesNotMatch(html, /buyers can mark an order as received/);
});

test('order cards identify the listing instead of showing only a generic link', () => {
  const data = fs.readFileSync(new URL('src/data/orders.js', root), 'utf8');
  assert.match(data, /items:item_id\(title\)/);
  assert.match(script, /escapeHtml\(row\.items\?\.title \|\| 'View item'\)/);
});

test('order loading failures provide an inline retry action and recover loading state', () => {
  assert.match(script, /async function loadOrders\(\)/);
  assert.ok(script.includes('class="retry-orders" type="button">Retry loading orders</button>'));
  assert.match(script, /status\.querySelector\('\.retry-orders'\)\?\.addEventListener\('click', loadOrders, \{ once: true \}\)/);
  assert.match(script, /status\.textContent = 'Loading…';/);
  assert.match(script, /loadOrders\(\);/);
});