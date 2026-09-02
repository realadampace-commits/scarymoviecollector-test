export const DEFAULT_PRIVACY = Object.freeze({
  profile_visibility: 'public',
  discoverable: true,
  allow_messages: 'everyone',
  show_avatar: true,
  show_bio: true,
  show_showcase: true,
  show_collection: true,
  show_sold_items: true,
  show_collection_values: true,
  show_activity_counts: true
});

export async function getOwnPrivacySettings(client) {
  const { data, error } = await client.rpc('get_own_privacy_settings');
  if (error) throw error;
  return { ...DEFAULT_PRIVACY, ...(Array.isArray(data) ? data[0] : data) };
}

export async function getProfilePrivacy(client, userId) {
  if (!userId) throw new TypeError('user id is required');
  const { data, error } = await client.rpc('get_profile_privacy', { target_user: userId });
  if (error) throw error;
  return { ...DEFAULT_PRIVACY, ...(Array.isArray(data) ? data[0] : data) };
}

export async function updateOwnPrivacySettings(client, userId, patch) {
  if (!userId) throw new TypeError('user id is required');
  const allowed = Object.keys(DEFAULT_PRIVACY);
  const clean = Object.fromEntries(Object.entries(patch ?? {}).filter(([key]) => allowed.includes(key)));
  const { data, error } = await client.from('profile_privacy').upsert({ user_id: userId, ...clean }, { onConflict: 'user_id' }).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('privacy settings were not saved');
  return { ...DEFAULT_PRIVACY, ...data };
}
