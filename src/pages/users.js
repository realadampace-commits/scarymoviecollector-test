import { getSupabaseClient } from '../supabase-client.js';
import { listProfiles, searchProfiles } from '../data/profiles.js';
import { escapeHtml } from '../ui.js';

const results = document.getElementById('results');
const status = document.getElementById('userStatus');
const input = document.getElementById('q');
const submit = document.getElementById('searchSubmit');
const initial = new URLSearchParams(location.search).get('q') || '';
let searchToken = 0;
input.value = initial;

async function runSearch(query) {
  const requestId = ++searchToken;
  submit.disabled = true;
  results.setAttribute('aria-busy', 'true');
  results.replaceChildren();
  status.textContent = query ? 'Searching members…' : 'Loading members…';
  try {
    const users = query
      ? await searchProfiles(getSupabaseClient(), query, { limit: 100 })
      : await listProfiles(getSupabaseClient());
    if (requestId !== searchToken) return;
    if (!users.length) {
      status.textContent = query ? 'No members found.' : 'No members have joined yet.';
      return;
    }
    results.innerHTML = users.map((user) => {
      const role = user.role || 'free';
      return `<div class="row"><div><strong>@${escapeHtml(user.username)}</strong> <span class="roleTag role-${escapeHtml(role)}">${escapeHtml(role)}</span></div><a href="user.html?u=${encodeURIComponent(user.username)}" aria-label="View @${escapeHtml(user.username)} profile">View</a></div>`;
    }).join('');
    status.textContent = query
      ? `Found ${users.length} member${users.length === 1 ? '' : 's'}.`
      : `Showing ${users.length} member${users.length === 1 ? '' : 's'}.`;
  } catch (error) {
    if (requestId !== searchToken) return;
    console.error(error);
    status.innerHTML = 'Unable to load members right now. <button class="retry-users" type="button">Retry loading members</button>';
  } finally {
    if (requestId === searchToken) {
      submit.disabled = false;
      results.removeAttribute('aria-busy');
    }
  }
}

document.getElementById('searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = input.value.trim();
  history.replaceState({}, '', query ? `users.html?q=${encodeURIComponent(query)}` : 'users.html');
  runSearch(query);
});

status.addEventListener('click', (event) => {
  if (event.target.closest('.retry-users')) runSearch(input.value.trim());
});

runSearch(initial);
