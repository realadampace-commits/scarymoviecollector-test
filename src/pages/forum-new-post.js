import { getSupabaseClient } from '../supabase-client.js';
const sb = getSupabaseClient();
const qs = new URLSearchParams(location.search);
const catId = qs.get('cat');
document.getElementById('back').href = 'forum_category.html?id=' + catId;

const titleEl = document.getElementById('title');
const bodyEl  = document.getElementById('body');
const saveBtn = document.getElementById('save');
const msgEl   = document.getElementById('msg');
const msg=(t,cls='muted')=>{msgEl.className=cls; msgEl.textContent=t;};

let me=null, myRole='free';

(async function init(){
  const { data:{ session } } = await sb.auth.getSession();
  if(!session){
    msg('Please sign in to create a post. Redirecting to sign in…','err');
    location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);
    return;
  }
  me = session.user;
  const { data:p } = await sb.from('profiles').select('role').eq('id',me.id).maybeSingle();
  myRole = p?.role || 'free';
  if (myRole==='free'){
    msg('Free members cannot create posts. Return to the category to keep browsing.','err');
    return;
  }
  saveBtn.disabled = false;
  saveBtn.removeAttribute('aria-disabled');
})();

saveBtn.addEventListener('click', async ()=>{
  const title = titleEl.value.trim();
  const body  = bodyEl.value.trim();
  if(!title || !body) return msg('Title and body required.','err');

  msg('Creating…');
  saveBtn.disabled = true;
  saveBtn.setAttribute('aria-busy', 'true');
  const { data: ins, error } = await sb.from('forum_posts').insert({
    title, body, category_id: catId, author_id: me.id   // <-- include author_id
  }).select('id').single();

  if (error) {
    saveBtn.disabled = false;
    saveBtn.removeAttribute('aria-busy');
    msg('Error: '+error.message+' Try again.','err');
    return;
  }
  location.href = 'forum_post.html?id=' + ins.id;
});
