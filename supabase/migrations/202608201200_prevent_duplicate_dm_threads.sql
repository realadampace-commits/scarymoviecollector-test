begin;

create or replace function public.create_dm_thread(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  thread_id uuid;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'authentication required'; end if;
  if other_user is null or other_user = caller then raise exception 'other user is required'; end if;
  if not exists (select 1 from public.profiles where id = other_user) then raise exception 'user not found'; end if;

  select t.id into thread_id
  from public.dm_threads t
  where public.is_dm_participant(t.id, caller)
    and exists (select 1 from public.dm_participants p where p.thread_id = t.id and p.user_id = other_user)
    and (select count(*) from public.dm_participants p where p.thread_id = t.id) = 2
  order by t.created_at asc
  limit 1;
  if thread_id is not null then return thread_id; end if;

  insert into public.dm_threads default values returning id into thread_id;
  insert into public.dm_participants(thread_id, user_id)
  values (thread_id, caller), (thread_id, other_user);
  return thread_id;
end;
$$;

revoke all on function public.create_dm_thread(uuid) from public;
grant execute on function public.create_dm_thread(uuid) to authenticated;

commit;
