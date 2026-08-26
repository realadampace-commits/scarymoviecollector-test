import { getSupabaseClient } from '../supabase-client.js';
const sb = getSupabaseClient();

// Attach first photo from items_images as preview_url
async function attachPreviews(items){
  if (!items?.length) return items;
  const ids = items.map(i=>i.id);
  const { data: imgs, error } = await sb
    .from('items_images')
    .select('item_id,image_url,position,created_at')
    .in('item_id', ids)
    .order('position',{ascending:true})
    .order('created_at',{ascending:true});
  if (error) { console.warn('preview query error:', error); return items; }
  const first = {};
  (imgs||[]).forEach(im => { if (!first[im.item_id]) first[im.item_id] = im.image_url; });
  return items.map(i => ({ ...i, preview_url: first[i.id] || null }));
}

const qEl = document.getElementById('q');
const goEl = document.getElementById('go');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');

let debounceTimer=null;
let searchToken=0;
qEl.addEventListener('input', ()=>{
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 300);
});
qEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); runSearch(); } });
document.getElementById('searchForm').addEventListener('submit', (event)=>{ event.preventDefault(); runSearch(); });

async function runSearch(){
  const requestId = ++searchToken;
  const raw = (qEl.value||'').trim();
  const term = raw.replace(/^@/, '');                    // allow @username searches
  if (!term){ resultsEl.innerHTML=''; statusEl.textContent='Type something to search.'; return; }

  // Clear the previous result set immediately so it cannot be mistaken for the
  // response to the new query while the request is in flight.
  resultsEl.innerHTML = '';
  statusEl.textContent = 'Searching…';

  // PostgREST uses * for wildcards in (i)like
  const like = `*${term}*`;

  // 1) Find owners by username (case-insensitive)
  const { data: owners, error: ownersErr } = await sb
    .from('profiles')
    .select('id,username,avatar_url')
    .ilike('username', like)
    .limit(200);

  if (requestId !== searchToken) return;

  if (ownersErr) { statusEl.textContent = 'Unable to search items right now. Please try again.'; return; }
  const ownerIds = (owners || []).map(o => o.id);

  // 2) Build OR over title/description, plus owner_id.in.(...) if we have owners
  const orParts = [
    `title.ilike.${like}`,
    `description.ilike.${like}`
  ];
  if (ownerIds.length){
    // comma-separated list inside parentheses
    orParts.push(`owner_id.in.(${ownerIds.join(',')})`);
  }

  const { data, error } = await sb.from('items')
    .select('id,title,description,user_value,created_at,owner_id,profiles:owner_id(username,avatar_url)')
    .or(orParts.join(','))
    .order('created_at',{ascending:false})
    .limit(60);

  if (requestId !== searchToken) return;

  if (error){
    console.error(error);
    statusEl.textContent = 'Unable to search items right now. Please try again.';
    resultsEl.innerHTML = '';
    return;
  }
  if (!data || !data.length){
    statusEl.textContent = 'No results.';
    resultsEl.innerHTML = '';
    return;
  }

  const withPrev = await attachPreviews(data);

  if (requestId !== searchToken) return;

  statusEl.textContent = `Found ${withPrev.length} item${withPrev.length===1?'':'s'}.`;
  resultsEl.innerHTML = withPrev.map(it=>{
    const ava = it.profiles?.avatar_url
      ? `<span class="ava"><img src="${escapeHtml(it.profiles.avatar_url)}" alt=""></span>`
      : `<span class="ava"></span>`;
    const uname = it.profiles?.username ? '@'+it.profiles.username : 'user';
    return `
      <div class="item">
        <a href="item.html?id=${escapeHtml(it.id)}" style="color:inherit;text-decoration:none">
          <div class="thumb">${it.preview_url ? `<img src="${escapeHtml(it.preview_url)}" alt="">` : 'No image'}</div>
          <div class="meta">
            <div><strong>${escapeHtml(it.title||'(untitled)')}</strong></div>
            <div class="owner">${ava}<span>${escapeHtml(uname)}</span></div>
            <div class="muted" style="margin-top:4px">$${(it.user_value||0).toLocaleString()}</div>
          </div>
        </a>
      </div>
    `;
  }).join('');
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// If query provided via ?q= in the URL, use it
const urlQ = new URLSearchParams(location.search).get('q');
if (urlQ){ qEl.value = urlQ; runSearch(); }
