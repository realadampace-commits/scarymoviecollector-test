export async function getFriendRelationship(client, userId) {
  if (!userId) throw new TypeError('user id is required');
  const { data, error } = await client.rpc('get_friend_relationship', { target_user: userId });
  if (error) throw error;
  return data || 'none';
}

export async function listFriends(client) {
  const { data, error } = await client.rpc('list_my_friends');
  if (error) throw error;
  return data ?? [];
}

export async function listFriendRequests(client) {
  const { data, error } = await client.rpc('list_my_friend_requests');
  if (error) throw error;
  return data ?? [];
}

export async function sendFriendRequest(client, userId) {
  if (!userId) throw new TypeError('user id is required');
  const { data, error } = await client.rpc('send_friend_request', { target_user: userId });
  if (error) throw error;
  return data;
}

export async function respondToFriendRequest(client, requestId, accept) {
  if (!requestId) throw new TypeError('request id is required');
  const { data, error } = await client.rpc('respond_friend_request', { target_request: requestId, accept_request: Boolean(accept) });
  if (error) throw error;
  return data;
}

export async function removeFriend(client, userId) {
  if (!userId) throw new TypeError('user id is required');
  const { error } = await client.rpc('remove_friend', { target_user: userId });
  if (error) throw error;
}

export async function blockUser(client, userId) {
  if (!userId) throw new TypeError('user id is required');
  const { error } = await client.rpc('block_user', { target_user: userId });
  if (error) throw error;
}

export async function unblockUser(client, userId) {
  if (!userId) throw new TypeError('user id is required');
  const { error } = await client.rpc('unblock_user', { target_user: userId });
  if (error) throw error;
}
