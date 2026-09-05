begin;

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friend_requests boolean not null default true,
  messages boolean not null default true,
  forum_activity boolean not null default true,
  item_votes boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check(type in('message','friend_request','friend_accepted','forum_reply','forum_like','item_vote')),
  title text not null,
  body text,
  href text,
  entity_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_id,type,entity_key)
);
create index notifications_recipient_created_idx on public.notifications(recipient_id,created_at desc);
create index notifications_recipient_unread_idx on public.notifications(recipient_id) where read_at is null;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "users read own notifications" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy "users update own notifications" on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create policy "users delete own notifications" on public.notifications for delete to authenticated using(recipient_id=(select auth.uid()));

create or replace function public.create_user_notification(target_user uuid,event_actor uuid,event_type text,event_title text,event_body text,event_href text,event_key text)
returns void language plpgsql security definer set search_path=public set row_security=off as $$
declare allowed boolean:=true; actor_name text;
begin
  if target_user is null or target_user=event_actor then return; end if;
  if event_actor is not null and public.is_blocked(target_user,event_actor) then return; end if;
  insert into public.notification_preferences(user_id) values(target_user) on conflict do nothing;
  select case when event_type in('friend_request','friend_accepted') then friend_requests when event_type='message' then messages when event_type in('forum_reply','forum_like') then forum_activity when event_type='item_vote' then item_votes else true end into allowed from public.notification_preferences where user_id=target_user;
  if not coalesce(allowed,true) then return; end if;
  select username into actor_name from public.profiles where id=event_actor;
  insert into public.notifications(recipient_id,actor_id,type,title,body,href,entity_key)
  values(target_user,event_actor,event_type,event_title,replace(coalesce(event_body,''),'{actor}',coalesce('@'||actor_name,'A member')),event_href,event_key)
  on conflict(recipient_id,type,entity_key) do update set actor_id=excluded.actor_id,title=excluded.title,body=excluded.body,href=excluded.href,read_at=null,created_at=now();
end; $$;
revoke all on function public.create_user_notification(uuid,uuid,text,text,text,text,text) from public;

create or replace function public.get_unread_notification_count() returns bigint language sql stable security definer set search_path=public set row_security=off as $$ select count(*) from public.notifications where recipient_id=auth.uid() and read_at is null; $$;
create or replace function public.list_my_notifications(result_limit integer default 50) returns setof public.notifications language sql stable security definer set search_path=public set row_security=off as $$ select * from public.notifications where recipient_id=auth.uid() order by created_at desc limit least(greatest(coalesce(result_limit,50),1),100); $$;
create or replace function public.mark_notification_read(target_notification uuid) returns void language sql security definer set search_path=public set row_security=off as $$ update public.notifications set read_at=coalesce(read_at,now()) where id=target_notification and recipient_id=auth.uid(); $$;
create or replace function public.mark_all_notifications_read() returns void language sql security definer set search_path=public set row_security=off as $$ update public.notifications set read_at=now() where recipient_id=auth.uid() and read_at is null; $$;
create or replace function public.get_notification_preferences() returns jsonb language plpgsql security definer set search_path=public as $$ declare result jsonb; begin if auth.uid() is null then raise exception 'authentication required'; end if; insert into public.notification_preferences(user_id) values(auth.uid()) on conflict do nothing; select to_jsonb(p) into result from public.notification_preferences p where user_id=auth.uid(); return result; end; $$;
revoke all on function public.get_unread_notification_count(),public.list_my_notifications(integer),public.mark_notification_read(uuid),public.mark_all_notifications_read(),public.get_notification_preferences() from public;
grant execute on function public.get_unread_notification_count(),public.list_my_notifications(integer),public.mark_notification_read(uuid),public.mark_all_notifications_read(),public.get_notification_preferences() to authenticated;

create or replace function public.notify_new_message() returns trigger language plpgsql security definer set search_path=public as $$ declare recipient uuid; begin for recipient in select user_id from public.dm_participants where thread_id=new.thread_id and user_id<>new.author_id loop perform public.create_user_notification(recipient,new.author_id,'message','New message','{actor} sent you a message.','messages.html?thread='||new.thread_id,new.thread_id::text); end loop; return new; end; $$;
create trigger notifications_after_dm_message after insert on public.dm_messages for each row execute function public.notify_new_message();
create or replace function public.notify_friend_request() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.create_user_notification(new.recipient_id,new.requester_id,'friend_request','New friend request','{actor} sent you a friend request.','friends.html',new.requester_id::text); return new; end; $$;
create trigger notifications_after_friend_request after insert on public.friend_requests for each row execute function public.notify_friend_request();
create or replace function public.notify_friendship() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.create_user_notification(new.user_low,new.user_high,'friend_accepted','Friend request accepted','You and {actor} are now friends.','friends.html',new.user_high::text); perform public.create_user_notification(new.user_high,new.user_low,'friend_accepted','Friend request accepted','You and {actor} are now friends.','friends.html',new.user_low::text); return new; end; $$;
create trigger notifications_after_friendship after insert on public.friendships for each row execute function public.notify_friendship();
create or replace function public.notify_forum_reply() returns trigger language plpgsql security definer set search_path=public as $$ declare owner_id uuid; begin select author_id into owner_id from public.forum_posts where id=new.post_id; perform public.create_user_notification(owner_id,new.author_id,'forum_reply','New reply','{actor} replied to your forum post.','forum_post.html?id='||new.post_id,new.post_id::text); return new; end; $$;
create trigger notifications_after_forum_reply after insert on public.forum_replies for each row execute function public.notify_forum_reply();
create or replace function public.notify_forum_like() returns trigger language plpgsql security definer set search_path=public as $$ declare owner_id uuid; begin select author_id into owner_id from public.forum_posts where id=new.post_id; perform public.create_user_notification(owner_id,new.user_id,'forum_like','New forum like','{actor} liked your forum post.','forum_post.html?id='||new.post_id,new.post_id::text); return new; end; $$;
create trigger notifications_after_forum_like after insert on public.forum_post_likes for each row execute function public.notify_forum_like();
create or replace function public.notify_item_vote() returns trigger language plpgsql security definer set search_path=public as $$ declare owner_id uuid; item_title text; begin select owner_id,title into owner_id,item_title from public.items where id=new.item_id; perform public.create_user_notification(owner_id,new.voter_id,'item_vote','New collectible vote','{actor} voted on '||coalesce(item_title,'your collectible')||'.','item.html?id='||new.item_id,new.item_id::text); return new; end; $$;
create trigger notifications_after_item_vote after insert or update on public.item_votes for each row execute function public.notify_item_vote();

create or replace function public.remove_entity_notifications() returns trigger language plpgsql security definer set search_path=public as $$ begin delete from public.notifications where entity_key=old.id::text and ((tg_table_name='forum_posts' and type in('forum_reply','forum_like')) or (tg_table_name='items' and type='item_vote') or (tg_table_name='dm_threads' and type='message')); return old; end; $$;
create trigger notifications_after_forum_post_delete after delete on public.forum_posts for each row execute function public.remove_entity_notifications();
create trigger notifications_after_item_delete after delete on public.items for each row execute function public.remove_entity_notifications();
create trigger notifications_after_dm_thread_delete after delete on public.dm_threads for each row execute function public.remove_entity_notifications();
create or replace function public.remove_friend_request_notification() returns trigger language plpgsql security definer set search_path=public as $$ begin delete from public.notifications where recipient_id=old.recipient_id and type='friend_request' and entity_key=old.requester_id::text; return old; end; $$;
create trigger notifications_after_friend_request_delete after delete on public.friend_requests for each row execute function public.remove_friend_request_notification();

commit;
