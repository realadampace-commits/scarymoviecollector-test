drop policy if exists "forum posts delete own or mod" on public.forum_posts;
drop policy if exists "forum posts delete own or admin" on public.forum_posts;

create policy "forum posts delete own or admin"
on public.forum_posts
for delete
to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('moderator', 'owner')
  )
);
