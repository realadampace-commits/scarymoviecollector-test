import { getSupabaseClient } from '../supabase-client.js';
import { requireSession, signOut } from '../auth.js';
import { getProfile, updateOwnProfile } from '../data/profiles.js';
import { uploadAvatar } from '../data/avatars.js';
import { listFrames, frameStyle } from '../data/frames.js';

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
const frameOverlay = document.getElementById('frameOverlay');
const framesRow = document.getElementById('framesRow');
const selectedFrame = profile?.frame_url ? { image_url: profile.frame_url, scale: profile.frame_scale, offset_x: profile.frame_offset_x, offset_y: profile.frame_offset_y } : null;
let pendingFrame = selectedFrame;
function applyFrame(frame) {
  if (!frameOverlay) return;
  frameOverlay.style.backgroundImage = frame?.image_url ? `url("${frame.image_url}")` : '';
  Object.entries(frameStyle(frame || {})).forEach(([key, value]) => frameOverlay.style.setProperty(key, value));
}
applyFrame(selectedFrame);
try {
  const frames = await listFrames(client);
  if (framesRow) {
    framesRow.replaceChildren();
    for (const frame of frames) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'frameCard';
      card.title = frame.title || 'Profile frame';
      const thumb = document.createElement('span');
      thumb.className = 'frameThumb';
      const image = document.createElement('img');
      image.src = frame.image_url;
      image.alt = frame.title || 'Profile frame';
      thumb.append(image);
      card.append(thumb);
      card.addEventListener('click', () => { pendingFrame = frame; applyFrame(frame); framesRow.querySelectorAll('.frameCard').forEach((item) => item.classList.remove('sel')); card.classList.add('sel'); });
      framesRow.append(card);
    }
  }
} catch (error) { console.warn('Unable to load profile frames.', error); }
document.getElementById('saveFrame')?.addEventListener('click', async () => {
  const message = document.getElementById('frameMsg');
  try { await updateOwnProfile(client, session.user.id, { frame_url: pendingFrame?.image_url || null, frame_scale: pendingFrame?.scale ?? 1, frame_offset_x: pendingFrame?.offset_x ?? 0, frame_offset_y: pendingFrame?.offset_y ?? 0 }); message.textContent = 'Frame saved.'; }
  catch (error) { message.textContent = error.message || 'Unable to save frame.'; }
});
document.getElementById('clearFrame')?.addEventListener('click', async () => {
  pendingFrame = null; applyFrame(null);
  const message = document.getElementById('frameMsg');
  try { await updateOwnProfile(client, session.user.id, { frame_url: null, frame_scale: 1, frame_offset_x: 0, frame_offset_y: 0 }); message.textContent = 'Frame removed.'; }
  catch (error) { message.textContent = error.message || 'Unable to remove frame.'; }
});
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
