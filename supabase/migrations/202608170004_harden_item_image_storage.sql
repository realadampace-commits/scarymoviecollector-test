begin;

drop policy if exists "owners or mods write item-images" on storage.objects;

commit;
