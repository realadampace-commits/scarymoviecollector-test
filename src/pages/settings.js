import { getSupabaseClient } from '../supabase-client.js';
import { requireSession, signOut } from '../auth.js';
import { getProfile, updateOwnProfile } from '../data/profiles.js';
import { uploadAvatar } from '../data/avatars.js';

const loginUrl = `login.html?next=${encodeURIComponent(`${location.pathname.split('/').pop() || 'settings.html'}${location.search}`)}`;

try {
const client = getSupabaseClient();
const session = await requireSession(client);
document.body.classList.remove('auth-pending');
const profile = await getProfile(client, session.user.id);
const username = document.getElementById('username');
const bio = document.getElementById('bioInput');
const showcase = document.getElementById('showcaseInput');
if (username) username.value = profile?.username || '';
if (bio) bio.value = profile?.bio || '';
if (showcase) showcase.value = Array.isArray(profile?.showcase_ids) ? profile.showcase_ids.join(', ') : '';
const avatarBox = document.getElementById('avatarBox');
const renderAvatar = (url) => {
  avatarBox.replaceChildren();
  if (!url) { avatarBox.textContent = 'No image'; return; }
  const image = document.createElement('img');
  image.src = url;
  image.alt = 'Current profile picture';
  avatarBox.append(image);
};
renderAvatar(profile?.avatar_url);
async function save(patch, messageId) {
  const message = document.getElementById(messageId);
  try { await updateOwnProfile(client, session.user.id, patch); message.textContent = 'Saved.'; }
  catch (error) { message.textContent = error.message || 'Unable to save.'; }
}
document.getElementById('saveUsername')?.addEventListener('click', () => save({ username: username.value.trim() }, 'userMsg'));
document.getElementById('saveBio')?.addEventListener('click', () => save({ bio: bio.value }, 'bioMsg'));
document.getElementById('saveShowcase')?.addEventListener('click', () => save({ showcase_ids: showcase.value.split(',').map((id) => id.trim()).filter(Boolean) }, 'showcaseMsg'));
document.getElementById('uploadAvatar')?.addEventListener('click', async () => {
  const file = document.getElementById('avatarFile')?.files?.[0];
  const button = document.getElementById('uploadAvatar');
  const message = document.getElementById('avatarMsg');
  button.disabled = true;
  message.textContent = 'Uploading…';
  try {
    const avatarUrl = await uploadAvatar(client, session.user.id, file);
    await updateOwnProfile(client, session.user.id, { avatar_url: avatarUrl });
    renderAvatar(avatarUrl);
    message.textContent = 'Profile picture updated.';
  } catch (error) { message.textContent = error.message || 'Unable to update profile picture.'; }
  finally { button.disabled = false; }
});
document.getElementById('logoutLocal')?.addEventListener('click', async () => { await signOut(client); location.href = 'login.html'; });
document.getElementById('logoutGlobal')?.addEventListener('click', async () => { await signOut(client); location.href = 'login.html'; });
} catch (error) {
  console.warn('Settings requires an authenticated configured session.', error);
  location.replace(loginUrl);
}
