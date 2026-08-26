export async function getForumPost(client, postId) {
  if (!postId || typeof postId !== 'string') throw new TypeError('post id is required');
  const { data, error } = await client.from('forum_posts').select('id,title,body,created_at,author_id,category_id').eq('id', postId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listForumReplies(client, postId) {
  if (!postId || typeof postId !== 'string') throw new TypeError('post id is required');
  const { data, error } = await client.from('forum_replies').select('id,post_id,author_id,body,created_at').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getForumCategory(client, categoryId) {
  if (!categoryId || typeof categoryId !== 'string') throw new TypeError('category id is required');
  let result = await client.from('forum_categories').select('id,title,description,cover_image_url,parent_id').eq('id', categoryId).maybeSingle();
  if (result.error) result = await client.from('forum_categories').select('id,title,parent_id').eq('id', categoryId).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function listForumChildren(client, categoryId) {
  if (!categoryId || typeof categoryId !== 'string') throw new TypeError('category id is required');
  let result = await client.from('forum_categories').select('id,title,description,cover_image_url,parent_id').eq('parent_id', categoryId).order('title', { ascending: true });
  if (result.error) result = await client.from('forum_categories').select('id,title,parent_id').eq('parent_id', categoryId).order('title', { ascending: true });
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function listCategoryPosts(client, categoryId, { limit = 100 } = {}) {
  if (!categoryId || typeof categoryId !== 'string') throw new TypeError('category id is required');
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const { data, error } = await client.from('forum_posts').select('id,title,body,created_at,author_id,category_id').eq('category_id', categoryId).order('created_at', { ascending: false }).limit(safeLimit);
  if (error) throw error;
  return data ?? [];
}

export async function listForumCategories(client) {
  let result = await client
    .from('forum_categories')
    .select('id,title,description,cover_image_url,created_at,parent_id')
    .is('parent_id', null)
    .order('title', { ascending: true });
  if (result.error) result = await client.from('forum_categories').select('id,title,created_at,parent_id').is('parent_id', null).order('title', { ascending: true });
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function createForumCategory(client, { title, description = '', coverImageUrl = '' } = {}) {
  const cleanTitle = String(title ?? '').trim();
  if (!cleanTitle) throw new TypeError('category title is required');
  const { data, error } = await client.from('forum_categories').insert({ title: cleanTitle, description: String(description).trim() || null, cover_image_url: String(coverImageUrl).trim() || null }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteForumCategory(client, categoryId) {
  if (!categoryId || typeof categoryId !== 'string') throw new TypeError('category id is required');
  const { error } = await client.from('forum_categories').delete().eq('id', categoryId);
  if (error) throw error;
}

export async function listForumPosts(client, { categoryId, limit = 25 } = {}) {
  if (categoryId != null && typeof categoryId !== 'string') throw new TypeError('category id must be a string');
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  let query = client
    .from('forum_posts')
    .select('id,category_id,author_id,title,body,created_at')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (categoryId) query = query.eq('category_id', categoryId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createForumReply(client, { postId, authorId, body }) {
  if (!postId || !authorId || !String(body ?? '').trim()) throw new TypeError('post, author, and body are required');
  const { data, error } = await client
    .from('forum_replies')
    .insert({ post_id: postId, author_id: authorId, body: String(body).trim() })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
