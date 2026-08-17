import { getSupabaseClient } from '../supabase-client.js';
import { getSession } from '../auth.js';
import { getProfile } from '../data/profiles.js';
import { listPortfolioItems } from '../data/items.js';
import { listItemImages, firstImage } from '../data/item-images.js';
import { escapeHtml, formatUsd } from '../ui.js';

const client = getSupabaseClient();
const msg = document.getElementById('msg');
const itemsEl = document.getElementById('items');
const totalEl = document.getElementById('total');
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

totalEl.textContent = `Total: ${formatUsd(prepared.reduce((sum, item) => sum + Number(item.user_value || 0), 0))}`;
if (!prepared.length) { msg.textContent = 'No items yet.'; }
itemsEl.innerHTML = prepared.map((item) => {
  const image = item.preview_url ? `<img src="${escapeHtml(item.preview_url)}" alt="">` : 'No image';
  const profile = item.profiles || owner;
  return `<div class="card"><a href="item.html?id=${encodeURIComponent(item.id)}" style="color:inherit;text-decoration:none"><div class="thumb">${image}</div><div class="meta"><strong>${escapeHtml(item.title)}</strong><div class="owner">@${escapeHtml(profile?.username || 'user')}</div><div>${formatUsd(item.user_value)}</div></div></a>${username ? '' : `<div style="padding:0 10px 12px"><a class="btn" href="edit.html?id=${encodeURIComponent(item.id)}" style="background:#444;padding:8px 12px">Edit</a></div>`}</div>`;
}).join('');
