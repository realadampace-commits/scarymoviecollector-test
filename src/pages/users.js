import { getSupabaseClient } from '../supabase-client.js';
import { searchProfiles } from '../data/profiles.js';
import { escapeHtml } from '../ui.js';

const results = document.getElementById('results');
const input = document.getElementById('q');
const submit = document.getElementById('searchSubmit');
const initial = new URLSearchParams(location.search).get('q') || '';
input.value = initial;

async function runSearch(query) {
  if (!query) { results.textContent = 'Type a name and press Search.'; return; }
  submit.disabled = true;
  results.setAttribute('aria-busy', 'true');
  results.textContent = 'Searching…';
  try {
    const users = await searchProfiles(getSupabaseClient(), query);
    if (!users.length) { results.textContent = 'No users found.'; return; }
    results.innerHTML = users.map((user) => {
      const role = user.role || 'free';
      return `<div class="row"><div><div><strong>@${escapeHtml(user.username)}</strong> <span class="roleTag role-${escapeHtml(role)}">${escapeHtml(role)}</span></div><div class="muted">${escapeHtml(user.id)}</div></div><a href="user.html?u=${encodeURIComponent(user.username)}" aria-label="View @${escapeHtml(user.username)} profile">View</a></div>`;
    }).join('');
  } catch (error) {
    console.error(error);
    results.innerHTML = 'Unable to search users right now. <button class="retry-users" type="button">Retry searching users</button>';
  } finally {
    submit.disabled = false;
    results.removeAttribute('aria-busy');
  }
}

document.getElementById('searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = input.value.trim();
  history.replaceState({}, '', query ? `users.html?q=${encodeURIComponent(query)}` : 'users.html');
  runSearch(query);
});

results.addEventListener('click', (event) => {
  if (event.target.closest('.retry-users')) runSearch(input.value.trim());
});

if (initial) runSearch(initial);
