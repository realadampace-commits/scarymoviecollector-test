export async function getItemVotes(client, itemId) {
  if (!itemId || typeof itemId !== 'string') throw new TypeError('item id is required');
  const { data, error } = await client
    .from('item_votes')
    .select('id,item_id,voter_id,agree,suggested_price,created_at,updated_at')
    .eq('item_id', itemId);
  if (error) throw error;
  const votes = data ?? [];
  const agree = votes.filter((vote) => vote.agree).length;
  const disagree = votes.length - agree;
  const suggestions = votes.filter((vote) => !vote.agree && Number.isFinite(Number(vote.suggested_price)));
  const averageSuggested = suggestions.length
    ? suggestions.reduce((sum, vote) => sum + Number(vote.suggested_price), 0) / suggestions.length
    : null;
  return { votes, agree, disagree, averageSuggested };
}

export async function saveItemVote(client, { itemId, voterId, agree, suggestedPrice = null }) {
  if (typeof itemId !== 'string' || typeof voterId !== 'string') throw new TypeError('item and voter ids must be strings');
  if (!itemId || !voterId || typeof agree !== 'boolean') throw new TypeError('item, voter, and vote are required');
  const price = agree ? null : Number(suggestedPrice);
  if (!agree && (suggestedPrice === null || suggestedPrice === undefined || !Number.isFinite(price) || price < 0)) throw new TypeError('a non-negative suggested price is required');
  const { data, error } = await client
    .from('item_votes')
    .upsert({ item_id: itemId, voter_id: voterId, agree, suggested_price: price }, { onConflict: 'item_id,voter_id' })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
