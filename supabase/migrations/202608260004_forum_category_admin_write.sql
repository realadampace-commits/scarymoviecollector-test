drop policy if exists "forum cats write mods" on public.forum_categories;
create policy "forum cats write admins" on public.forum_categories to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderator', 'owner')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderator', 'owner')));
