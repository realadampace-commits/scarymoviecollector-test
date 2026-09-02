export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

export function formatUsd(centsOrDollars) {
  const amount = Number(centsOrDollars ?? 0);
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(value) {
  if (value === null || value === undefined || value === '') return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

const finiteFrameValue = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback;
};

export function profileAvatarMarkup(profile, { name = '', className = '', label = '' } = {}) {
  const displayName = String(name || profile?.username || 'Community member').replace(/^@/, '');
  const initial = displayName.slice(0, 1).toUpperCase() || '?';
  const scale = finiteFrameValue(profile?.frame_scale, 1, 0.5, 2);
  const offsetX = finiteFrameValue(profile?.frame_offset_x, 0, -80, 80);
  const offsetY = finiteFrameValue(profile?.frame_offset_y, 0, -80, 80);
  const classes = ['profile-avatar', className].filter(Boolean).join(' ');
  const accessible = label ? ` role="img" aria-label="${escapeHtml(label)}"` : ' aria-hidden="true"';
  const photo = profile?.avatar_url
    ? `<img class="profile-avatar-photo" src="${escapeHtml(profile.avatar_url)}" alt="">`
    : `<span class="profile-avatar-fallback">${escapeHtml(initial)}</span>`;
  const frame = profile?.frame_url
    ? `<img class="profile-avatar-frame" src="${escapeHtml(profile.frame_url)}" alt="">`
    : '';
  return `<span class="${escapeHtml(classes)}" style="--frameScale:${scale};--frameX:${offsetX / 1.2}%;--frameY:${offsetY / 1.2}%"${accessible}>${photo}${frame}</span>`;
}
