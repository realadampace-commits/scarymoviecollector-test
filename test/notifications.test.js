import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_NOTIFICATION_PREFERENCES, getUnreadNotificationCount, updateNotificationPreferences } from '../src/data/notifications.js';
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('notification count uses the protected count RPC',async()=>{
  const calls=[]; const client={rpc(name,args){calls.push([name,args]);return Promise.resolve({data:7,error:null});}};
  assert.equal(await getUnreadNotificationCount(client),7); assert.deepEqual(calls,[['get_unread_notification_count',undefined]]);
});
test('notification preference updates only write supported booleans',async()=>{
  let written; const chain={upsert(value){written=value;return this;},select(){return this;},maybeSingle(){return Promise.resolve({data:value,error:null});}}; const value={};
  await updateNotificationPreferences({from(){return chain;}},'me',{messages:false,forum_activity:true,admin:true});
  assert.equal(written.user_id,'me'); assert.equal(written.messages,false); assert.equal(written.forum_activity,true); assert.equal('admin' in written,false); assert.deepEqual(Object.keys(DEFAULT_NOTIFICATION_PREFERENCES),['friend_requests','messages','forum_activity','item_votes']);
});
test('notification inbox and global bell expose unread controls',async()=>{
  const [page,script,menu,menuScript]=await Promise.all([read('notifications.html'),read('src/pages/notifications.js'),read('menu.html'),read('menu.js')]);
  assert.match(page,/id="markAll"/); assert.match(page,/aria-live="polite"/); assert.match(script,/markNotificationRead/); assert.match(script,/deleteNotification/); assert.match(menu,/notification-bell/); assert.match(menuScript,/getUnreadNotificationCount/); assert.match(menuScript,/postgres_changes/); assert.match(menuScript,/99\+/);
});
test('message notifications open their existing conversation',async()=>{ const [page,sql]=await Promise.all([read('src/pages/messages.js'),read('supabase/migrations/202609040001_notifications.sql')]); assert.match(page,/renderInbox\(threadFromUrl\)/); assert.match(sql,/messages\.html\?thread=/); });
test('database notifications cover every meaningful user interaction',async()=>{
  const sql=await read('supabase/migrations/202609040001_notifications.sql');
  for(const table of ['dm_messages','friend_requests','friendships','forum_replies','forum_post_likes','item_votes']) assert.match(sql,new RegExp(`after (?:insert|insert or update) on public\\.${table}`));
  assert.match(sql,/recipient_id=auth\.uid\(\)/); assert.match(sql,/get_unread_notification_count/); assert.match(sql,/notification_preferences/); assert.match(sql,/supabase_realtime/);
});
test('settings includes controls for every notification category',async()=>{
  const [page,script]=await Promise.all([read('settings.html'),read('src/pages/settings.js')]);
  for(const id of ['notifyFriendRequests','notifyMessages','notifyForumActivity','notifyItemVotes']) assert.match(page,new RegExp(`id="${id}"`));
  assert.match(script,/updateNotificationPreferences/); assert.match(page,/id="notificationMsg"[^>]*role="status"/);
});
