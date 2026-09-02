import { getSupabaseClient } from '../supabase-client.js';
import { requireSession } from '../auth.js';
import { blockUser, listFriendRequests, listFriends, removeFriend, respondToFriendRequest, sendFriendRequest } from '../data/friends.js';
import { searchProfiles } from '../data/profiles.js';
import { escapeHtml, profileAvatarMarkup } from '../ui.js';

const client = getSupabaseClient();
const session = await requireSession(client).catch(() => null);
if (!session) { location.href = 'login.html?next=friends.html'; throw new Error('authentication required'); }
const friendsEl = document.getElementById('friends'); const requestsEl = document.getElementById('requests');
const friendStatus = document.getElementById('friendStatus'); const requestStatus = document.getElementById('requestStatus');
const row = (profile, actions) => `<div class="friend-row" data-user-id="${escapeHtml(profile.id)}">${profileAvatarMarkup(profile,{name:profile.username,className:'avatar'})}<div class="friend-copy"><strong>@${escapeHtml(profile.username)}</strong></div><div class="friend-actions">${actions}</div></div>`;

async function renderDashboard() {
  const [friends, requests] = await Promise.all([listFriends(client), listFriendRequests(client)]);
  friendsEl.innerHTML = friends.map((p) => row(p, `<a class="btn" href="user.html?u=${encodeURIComponent(p.username)}">Profile</a><a class="btn" href="messages.html?u=${encodeURIComponent(p.username)}">Message</a><button class="btn remove-friend" type="button">Unfriend</button><button class="btn danger-link block-user" type="button">Block</button>`)).join('');
  friendStatus.textContent = friends.length ? `${friends.length} friend${friends.length===1?'':'s'}` : 'You have not added any friends yet.';
  requestsEl.innerHTML = requests.map((r) => row(r, r.direction === 'incoming' ? `<button class="btn accept-request" data-request-id="${escapeHtml(r.request_id)}" type="button">Accept</button><button class="btn decline-request" data-request-id="${escapeHtml(r.request_id)}" type="button">Decline</button>` : '<span class="muted">Request sent</span>')).join('');
  requestStatus.textContent = requests.length ? `${requests.length} pending request${requests.length===1?'':'s'}` : 'No pending requests.';
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button'); if (!target) return;
  const userId = target.closest('[data-user-id]')?.dataset.userId; target.disabled = true;
  try {
    if (target.classList.contains('accept-request')) await respondToFriendRequest(client,target.dataset.requestId,true);
    else if (target.classList.contains('decline-request')) await respondToFriendRequest(client,target.dataset.requestId,false);
    else if (target.classList.contains('remove-friend') && confirm('Remove this friend?')) await removeFriend(client,userId);
    else if (target.classList.contains('block-user') && confirm('Block this user? They will not be able to find, friend, or message you.')) await blockUser(client,userId);
    else if (target.classList.contains('add-friend')) await sendFriendRequest(client,userId);
    else return;
    await renderDashboard();
    target.closest('.search-result')?.remove();
  } catch (error) { console.error(error); target.textContent = 'Unable to update'; target.disabled = false; }
});

document.getElementById('friendSearch').addEventListener('submit', async (event) => {
  event.preventDefault(); const query=document.getElementById('friendQuery').value.trim(); const status=document.getElementById('searchStatus'); const results=document.getElementById('searchResults');
  status.textContent='Searching…'; results.replaceChildren();
  try { const profiles=(await searchProfiles(client,query,{limit:25})).filter((p)=>p.id!==session.user.id); results.innerHTML=profiles.map((p)=>row(p,`<a class="btn" href="user.html?u=${encodeURIComponent(p.username)}">Profile</a><button class="btn add-friend" type="button">Add friend</button>`).replace('friend-row','friend-row search-result')).join(''); status.textContent=profiles.length?'':'No matching collectors.'; }
  catch(error){console.error(error);status.textContent='Unable to search right now.';}
});

renderDashboard().catch((error)=>{console.error(error);friendStatus.textContent='Unable to load friends.';requestStatus.textContent='Unable to load requests.';});
