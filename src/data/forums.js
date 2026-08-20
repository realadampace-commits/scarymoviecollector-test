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
  const { data, error } = await client.from('forum_categories').select('id,title,parent_id').eq('id', categoryId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listForumChildren(client, categoryId) {
  if (!categoryId || typeof categoryId !== 'string') throw new TypeError('category id is required');
  const { data, error } = await client.from('forum_categories').select('id,title,parent_id').eq('parent_id', categoryId).order('title', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listCategoryPosts(client, categoryId) {
  if (!categoryId || typeof categoryId !== 'string') throw new TypeError('category id is required');
  const { data, error } = await client.from('forum_posts').select('id,title,body,created_at,author_id,category_id').eq('category_id', categoryId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listForumCategories(client) {
  const { data, error } = await client
    .from('forum_categories')
    .select('id,title,created_at,parent_id')
    .is('parent_id', null)
    .order('title', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listForumPosts(client, { categoryId, limit = 25 } = {}) {
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
