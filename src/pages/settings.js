import { getSupabaseClient } from '../supabase-client.js';
import { requireSession, signOut } from '../auth.js';
import { getProfile, updateOwnProfile } from '../data/profiles.js';
import { uploadAvatar } from '../data/avatars.js';
import { listFrames, createFrame } from '../data/frames.js';

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
async function save(patch, messageId, buttonId) {
  const message = document.getElementById(messageId);
  const button = buttonId ? document.getElementById(buttonId) : null;
  if (button?.disabled) return;
  if (button) button.disabled = true;
  if (message) message.textContent = 'Saving…';
  try { await updateOwnProfile(client, session.user.id, patch); if (message) message.textContent = 'Saved.'; }
  catch (error) { if (message) message.textContent = error.message || 'Unable to save.'; }
  finally { if (button) button.disabled = false; }
}
document.getElementById('saveUsername')?.addEventListener('click', () => save({ username: username.value.trim() }, 'userMsg', 'saveUsername'));
document.getElementById('saveBio')?.addEventListener('click', () => save({ bio: bio.value }, 'bioMsg', 'saveBio'));
document.getElementById('saveShowcase')?.addEventListener('click', () => save({ showcase_ids: showcase.value.split(',').map((id) => id.trim()).filter(Boolean) }, 'showcaseMsg', 'saveShowcase'));
document.getElementById('uploadAvatar')?.addEventListener('click', async () => {
  const file = document.getElementById('avatarFile')?.files?.[0];
  const button = document.getElementById('uploadAvatar');
  const message = document.getElementById('avatarMsg');
  if (!file) { message.textContent = 'Choose an image before uploading.'; return; }
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

const frameOverlay = document.getElementById('frameOverlay');
const frameMsg = document.getElementById('frameMsg');
let frames = [];
let selectedFrame = null;
const canUseFrames = ['subscriber', 'moderator', 'owner'].includes(profile?.role);
const renderFrame = (frame, target = frameOverlay) => {
  if (!target) return;
  target.style.backgroundImage = frame?.image_url ? `url(${JSON.stringify(frame.image_url)})` : '';
  target.style.setProperty('--frameScale', frame?.scale ?? profile?.frame_scale ?? 1);
  target.style.setProperty('--frameX', `${frame?.offset_x ?? profile?.frame_offset_x ?? 0}px`);
  target.style.setProperty('--frameY', `${frame?.offset_y ?? profile?.frame_offset_y ?? 0}px`);
};
renderFrame(profile?.frame_url ? { image_url: profile.frame_url, scale: profile.frame_scale, offset_x: profile.frame_offset_x, offset_y: profile.frame_offset_y } : null);
try {
  frames = await listFrames(client);
  const row = document.getElementById('framesRow');
  document.getElementById('lock').style.display = canUseFrames ? 'none' : 'flex';
  document.getElementById('subsTools').style.display = canUseFrames ? 'flex' : 'none';
  document.getElementById('modTools').style.display = ['moderator', 'owner'].includes(profile?.role) ? 'block' : 'none';
  row.replaceChildren(...frames.map((frame) => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'frameCard';
    if (frame.image_url === profile?.frame_url) { card.classList.add('sel'); selectedFrame = frame; }
    const thumb = document.createElement('div');
    thumb.className = 'frameThumb';
    const image = document.createElement('img');
    image.alt = '';
    image.src = frame.image_url;
    thumb.append(image);
    const title = document.createElement('div');
    title.textContent = frame.title || 'Untitled frame';
    card.append(thumb, title);
    card.addEventListener('click', () => { if (!canUseFrames) return; selectedFrame = frame; row.querySelectorAll('.frameCard').forEach((x) => x.classList.remove('sel')); card.classList.add('sel'); renderFrame(frame); });
    return card;
  }));
} catch (error) { frameMsg.textContent = error.message || 'Unable to load frames.'; }
document.getElementById('saveFrame')?.addEventListener('click', () => selectedFrame && save({ frame_url: selectedFrame.image_url, frame_scale: selectedFrame.scale, frame_offset_x: selectedFrame.offset_x, frame_offset_y: selectedFrame.offset_y }, 'frameMsg'));
document.getElementById('clearFrame')?.addEventListener('click', () => save({ frame_url: null, frame_scale: 1, frame_offset_x: 0, frame_offset_y: 0 }, 'frameMsg').then(() => renderFrame(null)));
document.getElementById('uploadFrame')?.addEventListener('click', async () => {
  const message = document.getElementById('uploadMsg'); const button = document.getElementById('uploadFrame'); button.disabled = true; message.textContent = 'Uploading…';
  try { const frame = await createFrame(client, session.user.id, document.getElementById('frameFile')?.files?.[0], { title: document.getElementById('frameTitle')?.value, scale: document.getElementById('frameScale')?.value }); frames.push(frame); selectedFrame = frame; renderFrame(frame); message.textContent = 'Frame uploaded and selected. Save to apply it.'; } catch (error) { message.textContent = error.message || 'Unable to upload frame.'; } finally { button.disabled = false; }
});
document.getElementById('logoutLocal')?.addEventListener('click', async () => { await signOut(client); location.href = 'login.html'; });
document.getElementById('logoutGlobal')?.addEventListener('click', async () => { await signOut(client); location.href = 'login.html'; });
} catch (error) {
  console.warn('Settings requires an authenticated configured session.', error);
  location.replace(loginUrl);
}
