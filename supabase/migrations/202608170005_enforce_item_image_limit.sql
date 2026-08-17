begin;

create or replace function public.enforce_item_image_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  image_count integer;
begin
  select count(*) into image_count from public.items_images where item_id = new.item_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if image_count >= 5 then raise exception 'maximum of five images per item'; end if;
  return new;
end;
$$;

drop trigger if exists items_images_limit on public.items_images;
create trigger items_images_limit
before insert or update of item_id on public.items_images
for each row execute function public.enforce_item_image_limit();

commit;
