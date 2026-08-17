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
