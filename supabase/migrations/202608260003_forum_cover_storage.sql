insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-covers', 'forum-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "forum cover admins upload" on storage.objects
for insert to authenticated with check (
  bucket_id = 'forum-covers' and exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'owner'))
);
create policy "forum covers public read" on storage.objects
for select using (bucket_id = 'forum-covers');
