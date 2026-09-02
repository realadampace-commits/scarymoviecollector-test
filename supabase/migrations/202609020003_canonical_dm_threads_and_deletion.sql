begin;

create table if not exists public.dm_thread_pairs (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null unique references public.dm_threads(id) on delete cascade,
  primary key (user_low, user_high),
  check (user_low < user_high)
);
alter table public.dm_thread_pairs enable row level security;

create temporary table dm_pair_canonical on commit drop as
select
  least(p1.user_id, p2.user_id) as user_low,
  greatest(p1.user_id, p2.user_id) as user_high,
  (array_agg(t.id order by t.created_at, t.id))[1] as canonical_id,
  array_agg(t.id order by t.created_at, t.id) as thread_ids
from public.dm_threads t
join public.dm_participants p1 on p1.thread_id = t.id
join public.dm_participants p2 on p2.thread_id = t.id and p1.user_id < p2.user_id
where (select count(*) from public.dm_participants pc where pc.thread_id = t.id) = 2
group by least(p1.user_id, p2.user_id), greatest(p1.user_id, p2.user_id);

update public.dm_messages m
set thread_id = pairs.canonical_id
from dm_pair_canonical pairs
where m.thread_id = any(pairs.thread_ids)
  and m.thread_id <> pairs.canonical_id;

delete from public.dm_threads t
using dm_pair_canonical pairs
where t.id = any(pairs.thread_ids)
  and t.id <> pairs.canonical_id;

insert into public.dm_thread_pairs(user_low, user_high, thread_id)
select user_low, user_high, canonical_id
from dm_pair_canonical
on conflict (user_low, user_high) do update set thread_id = excluded.thread_id;

create table if not exists public.dm_thread_hidden (
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.dm_thread_hidden enable row level security;
drop policy if exists "users read own hidden dm threads" on public.dm_thread_hidden;
create policy "users read own hidden dm threads" on public.dm_thread_hidden for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "users hide own dm threads" on public.dm_thread_hidden;
create policy "users hide own dm threads" on public.dm_thread_hidden for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_dm_participant(thread_id, (select auth.uid())));
drop policy if exists "users update own hidden dm threads" on public.dm_thread_hidden;
create policy "users update own hidden dm threads" on public.dm_thread_hidden for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "users unhide own dm threads" on public.dm_thread_hidden;
create policy "users unhide own dm threads" on public.dm_thread_hidden for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.create_dm_thread(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_thread_id uuid;
  new_thread_id uuid;
  caller uuid := auth.uid();
  low_user uuid;
  high_user uuid;
begin
  if caller is null then raise exception 'authentication required'; end if;
  if other_user is null or other_user = caller then raise exception 'other user is required'; end if;
  if not exists (select 1 from public.profiles where id = other_user) then raise exception 'user not found'; end if;
  low_user := least(caller, other_user);
  high_user := greatest(caller, other_user);

  select p.thread_id into result_thread_id from public.dm_thread_pairs p where p.user_low = low_user and p.user_high = high_user;
  if result_thread_id is null then
    insert into public.dm_threads default values returning id into new_thread_id;
    insert into public.dm_thread_pairs(user_low, user_high, thread_id)
      values (low_user, high_user, new_thread_id)
      on conflict (user_low, user_high) do nothing;
    if found then
      result_thread_id := new_thread_id;
      insert into public.dm_participants(thread_id, user_id) values (result_thread_id, caller), (result_thread_id, other_user);
    else
      delete from public.dm_threads where id = new_thread_id;
      select p.thread_id into result_thread_id from public.dm_thread_pairs p where p.user_low = low_user and p.user_high = high_user;
    end if;
  end if;
  delete from public.dm_thread_hidden h where h.thread_id = result_thread_id and h.user_id = caller;
  return result_thread_id;
end;
$$;

revoke all on function public.create_dm_thread(uuid) from public;
grant execute on function public.create_dm_thread(uuid) to authenticated;

create or replace function public.delete_dm_thread_for_all(target_thread uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_dm_participant(target_thread, auth.uid()) then raise exception 'not authorized'; end if;
  delete from public.dm_threads where id = target_thread;
  return found;
end;
$$;

revoke all on function public.delete_dm_thread_for_all(uuid) from public;
grant execute on function public.delete_dm_thread_for_all(uuid) to authenticated;

create or replace function public.restore_hidden_dm_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.dm_thread_hidden where thread_id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists restore_hidden_dm_on_message on public.dm_messages;
create trigger restore_hidden_dm_on_message after insert on public.dm_messages
for each row execute function public.restore_hidden_dm_on_message();

commit;
