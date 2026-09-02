begin;

create table if not exists public.item_models (
  item_id uuid primary key references public.items(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  model_url text not null,
  model_format text not null check (model_format in ('glb', 'gltf', 'obj', 'fbx', 'stl')),
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.item_models enable row level security;

create policy "item models are public" on public.item_models
for select using (true);

create policy "owners insert item models" on public.item_models
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.items where items.id = item_models.item_id and items.owner_id = (select auth.uid()))
);

create policy "owners update item models" on public.item_models
for update to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.items where items.id = item_models.item_id and items.owner_id = (select auth.uid()))
);

create policy "owners delete item models" on public.item_models
for delete to authenticated using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-models', 'item-models', true, 104857600,
  array['model/gltf-binary','model/gltf+json','application/octet-stream','text/plain','image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "item models public storage read" on storage.objects
for select using (bucket_id = 'item-models');

create policy "owners upload item model files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'item-models'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.items
    where items.id::text = (storage.foldername(name))[2]
      and items.owner_id = (select auth.uid())
  )
);

create policy "owners update item model files" on storage.objects
for update to authenticated
using (bucket_id = 'item-models' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'item-models' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "owners delete item model files" on storage.objects
for delete to authenticated
using (bucket_id = 'item-models' and (storage.foldername(name))[1] = (select auth.uid()::text));

commit;
