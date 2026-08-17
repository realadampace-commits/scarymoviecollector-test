import { getItem } from './items.js';
import { getProfile } from './profiles.js';
import { listItemImages } from './item-images.js';
import { getItemVotes } from './item-votes.js';

export async function getItemDetail(client, itemId) {
  const item = await getItem(client, itemId);
  if (!item) return null;
  const [owner, images, votes] = await Promise.all([
    getProfile(client, item.owner_id),
    listItemImages(client, item.id),
    getItemVotes(client, item.id)
  ]);
  return { item, owner, images, votes };
}
