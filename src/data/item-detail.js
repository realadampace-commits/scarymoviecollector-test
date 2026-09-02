import { getItem } from './items.js';
import { getProfile } from './profiles.js';
import { listItemImages } from './item-images.js';
import { getItemVotes } from './item-votes.js';
import { getItemModel } from './item-models.js';

export async function getItemDetail(client, itemId) {
  const item = await getItem(client, itemId);
  if (!item) return null;
  const [owner, images, votes, model] = await Promise.all([
    getProfile(client, item.owner_id),
    listItemImages(client, item.id),
    getItemVotes(client, item.id),
    getItemModel(client, item.id)
  ]);
  return { item, owner, images, votes, model };
}
