-- Add presentation fields for Facebook-style forum category cards.
alter table public.forum_categories
  add column if not exists description text,
  add column if not exists cover_image_url text;

comment on column public.forum_categories.cover_image_url is 'Optional public image URL used as the category banner/card cover.';
