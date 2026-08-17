import { getSupabaseClient } from '../supabase-client.js';
import { requireSession, signOut } from '../auth.js';
import { getProfile, updateOwnProfile } from '../data/profiles.js';

const client = getSupabaseClient();
const session = await requireSession(client);
const profile = await getProfile(client, session.user.id);
const username = document.getElementById('username');
const bio = document.getElementById('bioInput');
const showcase = document.getElementById('showcaseInput');
if (username) username.value = profile?.username || '';
if (bio) bio.value = profile?.bio || '';
if (showcase) showcase.value = Array.isArray(profile?.showcase_ids) ? profile.showcase_ids.join(', ') : '';
async function save(patch, messageId) {
  const message = document.getElementById(messageId);
  try { await updateOwnProfile(client, session.user.id, patch); message.textContent = 'Saved.'; }
  catch (error) { message.textContent = error.message || 'Unable to save.'; }
}
document.getElementById('saveUsername')?.addEventListener('click', () => save({ username: username.value.trim() }, 'userMsg'));
document.getElementById('saveBio')?.addEventListener('click', () => save({ bio: bio.value }, 'bioMsg'));
document.getElementById('saveShowcase')?.addEventListener('click', () => save({ showcase_ids: showcase.value.split(',').map((id) => id.trim()).filter(Boolean) }, 'showcaseMsg'));
document.getElementById('logoutLocal')?.addEventListener('click', async () => { await signOut(client); location.href = 'login.html'; });
document.getElementById('logoutGlobal')?.addEventListener('click', async () => { await signOut(client); location.href = 'login.html'; });
