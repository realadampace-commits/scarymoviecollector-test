export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({ friend_requests: true, messages: true, forum_activity: true, item_votes: true });

export async function listNotifications(client, { limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { data, error } = await client.rpc('list_my_notifications', { result_limit: safeLimit });
  if (error) throw error;
  return data ?? [];
}
export async function getUnreadNotificationCount(client) { const { data, error } = await client.rpc('get_unread_notification_count'); if (error) throw error; return Number(data) || 0; }
export async function markNotificationRead(client, notificationId) { if (!notificationId) throw new TypeError('notification id is required'); const { error } = await client.rpc('mark_notification_read', { target_notification: notificationId }); if (error) throw error; }
export async function markAllNotificationsRead(client) { const { error } = await client.rpc('mark_all_notifications_read'); if (error) throw error; }
export async function deleteNotification(client, notificationId) { if (!notificationId) throw new TypeError('notification id is required'); const { error } = await client.from('notifications').delete().eq('id', notificationId); if (error) throw error; }
export async function getNotificationPreferences(client) { const { data, error } = await client.rpc('get_notification_preferences'); if (error) throw error; return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data || {}) }; }
export async function updateNotificationPreferences(client, userId, patch) {
  if (!userId) throw new TypeError('user id is required');
  const safe = Object.fromEntries(Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).map((key) => [key, Boolean(patch?.[key])]));
  const { data, error } = await client.from('notification_preferences').upsert({ user_id: userId, ...safe, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().maybeSingle();
  if (error) throw error; return data;
}
