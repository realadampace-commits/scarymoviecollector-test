import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PRIVACY, updateOwnPrivacySettings } from '../src/data/privacy.js';
import { getFriendRelationship, sendFriendRequest } from '../src/data/friends.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('privacy defaults preserve existing member visibility until changed',()=>{
  assert.equal(DEFAULT_PRIVACY.profile_visibility,'public');
  assert.equal(DEFAULT_PRIVACY.allow_messages,'everyone');
  assert.equal(DEFAULT_PRIVACY.show_collection,true);
});

test('privacy updates drop unknown or privileged fields',async()=>{
  const calls=[]; const chain={upsert(value,options){calls.push([value,options]);return this;},select(){return this;},maybeSingle(){return Promise.resolve({data:{user_id:'me'},error:null});}};
  await updateOwnPrivacySettings({from(){return chain;}},'me',{profile_visibility:'friends',show_bio:false,role:'owner',user_id:'other'});
  assert.deepEqual(calls[0],[{user_id:'me',profile_visibility:'friends',show_bio:false},{onConflict:'user_id'}]);
});

test('friend data methods use protected RPC operations',async()=>{
  const calls=[];const client={rpc(name,args){calls.push([name,args]);return Promise.resolve({data:name==='get_friend_relationship'?'friends':'request',error:null});}};
  assert.equal(await getFriendRelationship(client,'other'),'friends'); await sendFriendRequest(client,'other');
  assert.deepEqual(calls,[['get_friend_relationship',{target_user:'other'}],['send_friend_request',{target_user:'other'}]]);
});

test('friends page supports requests, messages, unfriend, and blocking',async()=>{
  const [page,script,menu]=await Promise.all([read('friends.html'),read('src/pages/friends.js'),read('menu.html')]);
  assert.match(page,/id="requests"/);assert.match(page,/id="friends"/);assert.match(script,/respondToFriendRequest/);assert.match(script,/removeFriend/);assert.match(script,/blockUser/);assert.match(script,/messages\.html\?u=/);assert.match(menu,/href="friends\.html"/);
});

test('database policies connect friendship, blocking, privacy, collection, and messaging',async()=>{
  const sql=await read('supabase/migrations/202609020004_friends_and_privacy.sql');
  assert.match(sql,/create table public\.friendships/);assert.match(sql,/create table public\.user_blocks/);assert.match(sql,/profile_visibility in\('public','members','friends','private'\)/);assert.match(sql,/public\.are_friends/);assert.match(sql,/items respect profile privacy/);assert.match(sql,/public\.is_blocked\(caller,other_user\)/);assert.match(sql,/create policy dm_msg_ins/);
});

test('settings exposes friends-aware privacy controls with announced saving',async()=>{
  const [page,script]=await Promise.all([read('settings.html'),read('src/pages/settings.js')]);
  assert.match(page,/id="profileVisibility"/);assert.match(page,/<option value="friends">Friends only<\/option>/);assert.match(page,/id="allowMessages"/);assert.match(page,/id="privacyMsg"[^>]*role="status"/);assert.match(script,/updateOwnPrivacySettings/);
});
