import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { buildPortfolioHistory, selectPortfolioRange } from '../data/portfolio-history.js';
import { getProfile } from '../data/profiles.js';
import { listPortfolioItems } from '../data/items.js';
import { listItemImages, firstImage } from '../data/item-images.js';
import { escapeHtml, formatUsd } from '../ui.js';

const client = getSupabaseClient();
const msg = document.getElementById('msg');
const itemsEl = document.getElementById('items');
const totalEl = document.getElementById('total');
const changeEl = document.getElementById('change');
const highEl = document.getElementById('high');
const lowEl = document.getElementById('low');
const chartEl = document.getElementById('chart');
const titleEl = document.getElementById('title');
const params = new URLSearchParams(location.search);
const username = params.get('u');
let ownerId;
let owner;

if (username) {
  const { data, error } = await client.from('profiles').select('id,username,avatar_url').eq('username', username).maybeSingle();
  if (error || !data) { msg.textContent = 'User not found.'; throw new Error('user not found'); }
  owner = data; ownerId = data.id;
} else {
  const session = await getSession(client);
  if (!session) { location.href = 'login.html?next=portfolio.html'; throw new Error('authentication required'); }
  ownerId = session.user.id;
  owner = await getProfile(client, ownerId);
}

titleEl.textContent = `@${owner.username || 'user'} — Portfolio`;
const items = await listPortfolioItems(client, ownerId);
const prepared = await Promise.all(items.map(async (item) => ({ ...item, preview_url: firstImage(await listItemImages(client, item.id)) })));
const history = buildPortfolioHistory(prepared);
const total = prepared.reduce((sum, item) => sum + Number(item.user_value || 0), 0);
totalEl.textContent = formatUsd(total);

const chartSvg = (points) => {
  if (!points.length) return '<div class="chart-empty">Add collection items to start a value history.</div>';
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const width = 800;
  const height = 260;
  const padding = 12;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * (width - padding * 2),
    y: height - padding - ((point.value - min) / spread) * (height - padding * 2),
  }));
  const polyline = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = coordinates.at(-1);
  return `<svg class="portfolio-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Current stated collection value grouped by item-added date"><line class="chart-grid" x1="0" y1="36" x2="${width}" y2="36"></line><line class="chart-grid" x1="0" y1="130" x2="${width}" y2="130"></line><line class="chart-grid" x1="0" y1="224" x2="${width}" y2="224"></line><polyline class="chart-line" points="${polyline}"></polyline><circle class="chart-dot" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="7"></circle></svg>`;
};

const renderRange = (range) => {
  const points = selectPortfolioRange(history, range);
  const values = points.map((point) => point.value);
  const first = values[0] ?? 0;
  const latest = values.at(-1) ?? 0;
  const change = latest - first;
  chartEl.innerHTML = chartSvg(points);
  highEl.textContent = formatUsd(values.length ? Math.max(...values) : 0);
  lowEl.textContent = formatUsd(values.length ? Math.min(...values) : 0);
  if (!points.length) changeEl.textContent = 'No dated collection items in this range.';
  else changeEl.innerHTML = `<span class="${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '+' : ''}${formatUsd(change)}</span><span>Current stated value added by items dated ${range === 'ALL' ? 'all time' : range}</span>`;
  document.querySelectorAll('.range').forEach((button) => { button.setAttribute('aria-pressed', String(button.dataset.range === range)); });
};

document.querySelectorAll('.range').forEach((button) => button.addEventListener('click', () => renderRange(button.dataset.range)));
renderRange('3M');
if (!prepared.length) msg.textContent = 'No items yet.';
itemsEl.innerHTML = prepared.map((item) => {
  const image = item.preview_url ? `<img src="${escapeHtml(item.preview_url)}" alt="">` : 'No image';
  const profile = item.profiles || owner;
  return `<div class="card"><a href="item.html?id=${encodeURIComponent(item.id)}" style="color:inherit;text-decoration:none"><div class="thumb">${image}</div><div class="meta"><strong>${escapeHtml(item.title)}</strong><div class="owner">@${escapeHtml(profile?.username || 'user')}</div><div>${formatUsd(item.user_value)}</div></div></a>${username ? '' : `<div style="padding:0 10px 12px"><a class="btn" href="edit.html?id=${encodeURIComponent(item.id)}" style="background:#444;padding:8px 12px">Edit</a></div>`}</div>`;
}).join('');
