begin;

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(), requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
  unique(requester_id,recipient_id), check(requester_id<>recipient_id)
);
create table public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade, user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_low,user_high), check(user_low<user_high)
);
create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade, blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;

create or replace function public.are_friends(first_user uuid, second_user uuid) returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select exists(select 1 from public.friendships where user_low=least(first_user,second_user) and user_high=greatest(first_user,second_user));
$$;
create or replace function public.is_blocked(first_user uuid, second_user uuid) returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select exists(select 1 from public.user_blocks where (blocker_id=first_user and blocked_id=second_user) or (blocker_id=second_user and blocked_id=first_user));
$$;
revoke all on function public.are_friends(uuid,uuid), public.is_blocked(uuid,uuid) from public;
grant execute on function public.are_friends(uuid,uuid), public.is_blocked(uuid,uuid) to anon,authenticated;

create table public.profile_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_visibility text not null default 'public' check(profile_visibility in('public','members','friends','private')),
  discoverable boolean not null default true,
  allow_messages text not null default 'everyone' check(allow_messages in('everyone','friends','existing','nobody')),
  show_avatar boolean not null default true, show_bio boolean not null default true, show_showcase boolean not null default true,
  show_collection boolean not null default true, show_sold_items boolean not null default true,
  show_collection_values boolean not null default true, show_activity_counts boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.profile_privacy(user_id) select id from public.profiles on conflict do nothing;
alter table public.profile_privacy enable row level security;
create policy "users read own privacy" on public.profile_privacy for select to authenticated using(user_id=(select auth.uid()));
create policy "users insert own privacy" on public.profile_privacy for insert to authenticated with check(user_id=(select auth.uid()));
create policy "users update own privacy" on public.profile_privacy for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create or replace function public.can_view_profile(target_user uuid) returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select not public.is_blocked(auth.uid(),target_user) and (
    target_user=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role in('moderator','owner'))
    or coalesce((select profile_visibility='public' or (profile_visibility='members' and auth.uid() is not null) or (profile_visibility='friends' and public.are_friends(auth.uid(),target_user)) from public.profile_privacy where user_id=target_user),true)
  );
$$;
revoke all on function public.can_view_profile(uuid) from public; grant execute on function public.can_view_profile(uuid) to anon,authenticated;

drop policy if exists "public read profiles" on public.profiles; drop policy if exists "read profiles for all" on public.profiles;
create policy "profiles respect privacy and blocks" on public.profiles for select to anon,authenticated using(public.can_view_profile(id));

create or replace function public.get_own_privacy_settings() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; begin if auth.uid() is null then raise exception 'authentication required'; end if;
insert into public.profile_privacy(user_id) values(auth.uid()) on conflict do nothing;
select to_jsonb(s) into result from public.profile_privacy s where user_id=auth.uid(); return result; end; $$;
create or replace function public.get_profile_privacy(target_user uuid) returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
  select jsonb_build_object('profile_visibility',coalesce(s.profile_visibility,'public'),'discoverable',coalesce(s.discoverable,true),'allow_messages',coalesce(s.allow_messages,'everyone'),'show_avatar',coalesce(s.show_avatar,true),'show_bio',coalesce(s.show_bio,true),'show_showcase',coalesce(s.show_showcase,true),'show_collection',coalesce(s.show_collection,true),'show_sold_items',coalesce(s.show_sold_items,true),'show_collection_values',coalesce(s.show_collection_values,true),'show_activity_counts',coalesce(s.show_activity_counts,true)) from (select 1) seed left join public.profile_privacy s on s.user_id=target_user;
$$;
revoke all on function public.get_own_privacy_settings(),public.get_profile_privacy(uuid) from public;
grant execute on function public.get_own_privacy_settings() to authenticated; grant execute on function public.get_profile_privacy(uuid) to anon,authenticated;

create or replace function public.search_visible_profiles(search_term text default '',result_limit integer default 50,result_offset integer default 0)
returns table(id uuid,username text,role text) language sql stable security definer set search_path=public set row_security=off as $$
select p.id,p.username,p.role from public.profiles p left join public.profile_privacy s on s.user_id=p.id
where p.username is not null and coalesce(s.discoverable,true) and public.can_view_profile(p.id)
and (coalesce(trim(search_term),'')='' or p.username ilike '%'||replace(replace(trim(search_term),'%','\%'),'_','\_')||'%' escape '\')
order by p.username limit least(greatest(coalesce(result_limit,50),1),1000) offset greatest(coalesce(result_offset,0),0); $$;
revoke all on function public.search_visible_profiles(text,integer,integer) from public; grant execute on function public.search_visible_profiles(text,integer,integer) to anon,authenticated;

create or replace function public.get_friend_relationship(target_user uuid) returns text language sql stable security definer set search_path=public set row_security=off as $$
select case when target_user=auth.uid() then 'self' when exists(select 1 from public.user_blocks where blocker_id=auth.uid() and blocked_id=target_user) then 'blocked_by_me' when exists(select 1 from public.user_blocks where blocker_id=target_user and blocked_id=auth.uid()) then 'blocked_me' when public.are_friends(auth.uid(),target_user) then 'friends' when exists(select 1 from public.friend_requests where requester_id=auth.uid() and recipient_id=target_user) then 'outgoing' when exists(select 1 from public.friend_requests where requester_id=target_user and recipient_id=auth.uid()) then 'incoming' else 'none' end; $$;
create or replace function public.send_friend_request(target_user uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare request_id uuid; reverse_id uuid; begin if auth.uid() is null or target_user is null or target_user=auth.uid() then raise exception 'invalid friend request'; end if; if public.is_blocked(auth.uid(),target_user) then raise exception 'friend request unavailable'; end if; if public.are_friends(auth.uid(),target_user) then return null; end if;
select id into reverse_id from public.friend_requests where requester_id=target_user and recipient_id=auth.uid(); if reverse_id is not null then insert into public.friendships(user_low,user_high) values(least(auth.uid(),target_user),greatest(auth.uid(),target_user)) on conflict do nothing; delete from public.friend_requests where id=reverse_id; return null; end if;
insert into public.friend_requests(requester_id,recipient_id) values(auth.uid(),target_user) on conflict(requester_id,recipient_id) do update set created_at=excluded.created_at returning id into request_id; return request_id; end; $$;
create or replace function public.respond_friend_request(target_request uuid,accept_request boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare requester uuid; begin select requester_id into requester from public.friend_requests where id=target_request and recipient_id=auth.uid(); if requester is null then raise exception 'request not found'; end if; if accept_request and not public.is_blocked(auth.uid(),requester) then insert into public.friendships(user_low,user_high) values(least(auth.uid(),requester),greatest(auth.uid(),requester)) on conflict do nothing; end if; delete from public.friend_requests where id=target_request; return accept_request; end; $$;
create or replace function public.remove_friend(target_user uuid) returns void language plpgsql security definer set search_path=public as $$ begin delete from public.friendships where user_low=least(auth.uid(),target_user) and user_high=greatest(auth.uid(),target_user); end; $$;
create or replace function public.block_user(target_user uuid) returns void language plpgsql security definer set search_path=public as $$ declare existing_thread uuid; begin if auth.uid() is null or target_user=auth.uid() then raise exception 'invalid block'; end if; delete from public.friendships where user_low=least(auth.uid(),target_user) and user_high=greatest(auth.uid(),target_user); delete from public.friend_requests where (requester_id=auth.uid() and recipient_id=target_user) or (requester_id=target_user and recipient_id=auth.uid()); insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),target_user) on conflict do nothing; select thread_id into existing_thread from public.dm_thread_pairs where user_low=least(auth.uid(),target_user) and user_high=greatest(auth.uid(),target_user); if existing_thread is not null then insert into public.dm_thread_hidden(thread_id,user_id) values(existing_thread,auth.uid()) on conflict(thread_id,user_id) do update set hidden_at=now(); end if; end; $$;
create or replace function public.unblock_user(target_user uuid) returns void language plpgsql security definer set search_path=public as $$ begin delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=target_user; end; $$;
revoke all on function public.get_friend_relationship(uuid),public.send_friend_request(uuid),public.respond_friend_request(uuid,boolean),public.remove_friend(uuid),public.block_user(uuid),public.unblock_user(uuid) from public;
grant execute on function public.get_friend_relationship(uuid),public.send_friend_request(uuid),public.respond_friend_request(uuid,boolean),public.remove_friend(uuid),public.block_user(uuid),public.unblock_user(uuid) to authenticated;

create or replace function public.list_my_friends() returns table(id uuid,username text,avatar_url text,frame_url text,frame_scale numeric,frame_offset_x numeric,frame_offset_y numeric) language sql stable security definer set search_path=public set row_security=off as $$
select p.id,p.username,p.avatar_url,p.frame_url,p.frame_scale,p.frame_offset_x,p.frame_offset_y from public.friendships f join public.profiles p on p.id=case when f.user_low=auth.uid() then f.user_high else f.user_low end where auth.uid() in(f.user_low,f.user_high) order by p.username; $$;
create or replace function public.list_my_friend_requests() returns table(request_id uuid,direction text,id uuid,username text,avatar_url text,frame_url text,frame_scale numeric,frame_offset_x numeric,frame_offset_y numeric) language sql stable security definer set search_path=public set row_security=off as $$
select r.id,case when r.recipient_id=auth.uid() then 'incoming' else 'outgoing' end,p.id,p.username,p.avatar_url,p.frame_url,p.frame_scale,p.frame_offset_x,p.frame_offset_y from public.friend_requests r join public.profiles p on p.id=case when r.recipient_id=auth.uid() then r.requester_id else r.recipient_id end where auth.uid() in(r.requester_id,r.recipient_id) order by r.created_at desc; $$;
revoke all on function public.list_my_friends(),public.list_my_friend_requests() from public; grant execute on function public.list_my_friends(),public.list_my_friend_requests() to authenticated;

drop policy if exists "items read all" on public.items; drop policy if exists "public read items" on public.items; drop policy if exists "read items for all" on public.items;
create policy "items respect profile privacy" on public.items for select to anon,authenticated using(owner_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in('moderator','owner')) or (public.can_view_profile(owner_id) and coalesce((select show_collection and (show_sold_items or items.sold_at is null) from public.profile_privacy where user_id=owner_id),true)));
drop policy if exists "public read item images" on public.items_images; drop policy if exists "read item_images for all" on public.items_images;
create policy "item images follow item privacy" on public.items_images for select to anon,authenticated using(exists(select 1 from public.items i where i.id=item_id));
drop policy if exists "item models are public" on public.item_models;
create policy "item models follow item privacy" on public.item_models for select to anon,authenticated using(exists(select 1 from public.items i where i.id=item_id));

drop policy if exists dm_msg_ins on public.dm_messages;
create policy dm_msg_ins on public.dm_messages for insert to authenticated with check(
  author_id=(select auth.uid()) and public.is_dm_participant(thread_id,(select auth.uid())) and not exists(
    select 1 from public.dm_participants other where other.thread_id=dm_messages.thread_id and other.user_id<>(select auth.uid()) and public.is_blocked((select auth.uid()),other.user_id)
  )
);

create or replace function public.create_dm_thread(other_user uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare result_thread_id uuid;new_thread_id uuid;caller uuid:=auth.uid();low_user uuid;high_user uuid;message_rule text;
begin if caller is null then raise exception 'authentication required'; end if; if other_user is null or other_user=caller or public.is_blocked(caller,other_user) then raise exception 'conversation unavailable'; end if;
low_user:=least(caller,other_user);high_user:=greatest(caller,other_user);select thread_id into result_thread_id from public.dm_thread_pairs where user_low=low_user and user_high=high_user;
if result_thread_id is null then select coalesce(allow_messages,'everyone') into message_rule from public.profile_privacy where user_id=other_user; if coalesce(message_rule,'everyone')='nobody' or coalesce(message_rule,'everyone')='existing' or (message_rule='friends' and not public.are_friends(caller,other_user)) then raise exception 'this member is not accepting new conversations'; end if;
insert into public.dm_threads default values returning id into new_thread_id;insert into public.dm_thread_pairs(user_low,user_high,thread_id) values(low_user,high_user,new_thread_id) on conflict(user_low,user_high) do nothing;
if found then result_thread_id:=new_thread_id;insert into public.dm_participants(thread_id,user_id) values(result_thread_id,caller),(result_thread_id,other_user);else delete from public.dm_threads where id=new_thread_id;select thread_id into result_thread_id from public.dm_thread_pairs where user_low=low_user and user_high=high_user;end if;end if;
delete from public.dm_thread_hidden where thread_id=result_thread_id and user_id=caller;return result_thread_id;end; $$;
revoke all on function public.create_dm_thread(uuid) from public;grant execute on function public.create_dm_thread(uuid) to authenticated;

commit;
