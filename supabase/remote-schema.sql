--
-- PostgreSQL database dump
--

\restrict ECCvmEEKAa7z5OjevFweLJ4mq4D98gr9dzB7L091VQGj5u6b4klRCkPUMzhoULk

-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: bump_post_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_post_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if TG_TABLE_NAME='forum_posts' then
    if TG_OP='INSERT' then update public.profiles set post_count = coalesce(post_count,0)+1 where id=new.author_id;
    elsif TG_OP='DELETE' then update public.profiles set post_count = greatest(coalesce(post_count,1)-1,0) where id=old.author_id;
    end if;
  elsif TG_TABLE_NAME='forum_replies' then
    if TG_OP='INSERT' then update public.profiles set reply_count = coalesce(reply_count,0)+1 where id=new.author_id;
    elsif TG_OP='DELETE' then update public.profiles set reply_count = greatest(coalesce(reply_count,1)-1,0) where id=old.author_id;
    end if;
  end if;
  return null;
end $$;


--
-- Name: category_is_leaf(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.category_is_leaf(c uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select not exists (select 1 from public.forum_categories sc where sc.parent_id = c)
$$;


--
-- Name: enforce_leaf_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_leaf_post() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not public.category_is_leaf(new.category_id) then
    raise exception 'You can only post in leaf categories.';
  end if;
  return new;
end $$;


--
-- Name: enforce_price_band(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_price_band() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
declare base numeric;
begin
  if new.agree then
    new.suggested_price := null;
    return new;
  end if;

  select user_value into base from public.items where id = new.item_id;
  if base is null then
    raise exception 'Base price missing for item %', new.item_id;
  end if;

  if new.suggested_price is null then
    raise exception 'A suggestion is required when disagreeing';
  end if;

  if new.suggested_price < base * 0.70 or new.suggested_price > base * 1.30 then
    raise exception 'Suggested price must be within ±30%% of $%', base;
  end if;

  return new;
end $_$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email,'@',1))
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: is_dm_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_dm_participant(_thread_id uuid, _uid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.dm_participants
    where thread_id = _thread_id
      and user_id   = _uid
  );
$$;


--
-- Name: items_sold_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.items_sold_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$begin
  if NEW.sold is true then
    NEW.is_for_sale := false;
  end if;
  return NEW;
end$$;


--
-- Name: set_author_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_author_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.author_id := auth.uid();
  return new;
end $$;


--
-- Name: set_created_by(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_created_by() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.created_by := auth.uid();
  return new;
end $$;


--
-- Name: set_item_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_item_owner() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end $$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dm_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dm_messages_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: dm_latest; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.dm_latest AS
 SELECT DISTINCT ON (thread_id) thread_id,
    id AS message_id,
    body,
    author_id,
    created_at
   FROM public.dm_messages m
  ORDER BY thread_id, created_at DESC;


--
-- Name: dm_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_participants (
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone
);


--
-- Name: dm_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: forum_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    parent_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: forum_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    author_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: forum_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: frames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frames (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    image_url text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    scale numeric DEFAULT 1.0,
    offset_x numeric DEFAULT 0,
    offset_y numeric DEFAULT 0,
    CONSTRAINT frames_scale_check CHECK (((scale >= 0.5) AND (scale <= 2.0)))
);


--
-- Name: item_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    voter_id uuid NOT NULL,
    agree boolean NOT NULL,
    suggested_price numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT item_votes_check CHECK ((agree OR (suggested_price IS NOT NULL))),
    CONSTRAINT item_votes_check1 CHECK (((NOT agree) OR (suggested_price IS NULL)))
);


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    user_value integer DEFAULT 0 NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    is_for_sale boolean DEFAULT false NOT NULL,
    price_usdc bigint DEFAULT 0 NOT NULL,
    sale_currency text DEFAULT 'USDC_BASE'::text NOT NULL,
    sold boolean DEFAULT false,
    sold_price numeric,
    sold_at timestamp with time zone
);


--
-- Name: items_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    image_url text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    item_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    price_usdc bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USDC'::text,
    method text DEFAULT 'USDC_BASE'::text,
    tx_hash text,
    chain_id text,
    status text DEFAULT 'paid'::text NOT NULL,
    tracking_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    created_at timestamp with time zone DEFAULT now(),
    avatar_url text,
    bio text,
    showcase_ids uuid[] DEFAULT '{}'::uuid[],
    role text DEFAULT 'free'::text,
    frame_url text,
    frame_scale numeric DEFAULT 1.0,
    post_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,
    frame_offset_x numeric DEFAULT 0,
    frame_offset_y numeric DEFAULT 0,
    usdc_base_address text,
    CONSTRAINT profiles_frame_scale_check CHECK (((frame_scale >= 0.5) AND (frame_scale <= 2.0))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['free'::text, 'subscriber'::text, 'moderator'::text, 'owner'::text])))
);


--
-- Name: dm_messages dm_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_messages
    ADD CONSTRAINT dm_messages_pkey PRIMARY KEY (id);


--
-- Name: dm_participants dm_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_pkey PRIMARY KEY (thread_id, user_id);


--
-- Name: dm_threads dm_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_threads
    ADD CONSTRAINT dm_threads_pkey PRIMARY KEY (id);


--
-- Name: forum_categories forum_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT forum_categories_pkey PRIMARY KEY (id);


--
-- Name: forum_posts forum_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_pkey PRIMARY KEY (id);


--
-- Name: forum_replies forum_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT forum_replies_pkey PRIMARY KEY (id);


--
-- Name: frames frames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frames
    ADD CONSTRAINT frames_pkey PRIMARY KEY (id);


--
-- Name: item_votes item_votes_item_id_voter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_votes
    ADD CONSTRAINT item_votes_item_id_voter_id_key UNIQUE (item_id, voter_id);


--
-- Name: item_votes item_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_votes
    ADD CONSTRAINT item_votes_pkey PRIMARY KEY (id);


--
-- Name: items_images items_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items_images
    ADD CONSTRAINT items_images_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: dm_messages_thread_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dm_messages_thread_created_idx ON public.dm_messages USING btree (thread_id, created_at);


--
-- Name: forum_categories trg_cats_set_creator; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cats_set_creator BEFORE INSERT ON public.forum_categories FOR EACH ROW EXECUTE FUNCTION public.set_created_by();


--
-- Name: item_votes trg_item_votes_band; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_item_votes_band BEFORE INSERT OR UPDATE ON public.item_votes FOR EACH ROW EXECUTE FUNCTION public.enforce_price_band();


--
-- Name: item_votes trg_item_votes_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_item_votes_touch BEFORE UPDATE ON public.item_votes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: items trg_items_set_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_items_set_owner BEFORE INSERT ON public.items FOR EACH ROW EXECUTE FUNCTION public.set_item_owner();


--
-- Name: items trg_items_sold_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_items_sold_guard BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.items_sold_guard();


--
-- Name: forum_posts trg_leaf_enforce; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leaf_enforce BEFORE INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.enforce_leaf_post();


--
-- Name: forum_posts trg_posts_count_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_posts_count_del AFTER DELETE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.bump_post_count();


--
-- Name: forum_posts trg_posts_count_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_posts_count_ins AFTER INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.bump_post_count();


--
-- Name: forum_posts trg_posts_set_author; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_posts_set_author BEFORE INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.set_author_id();


--
-- Name: forum_replies trg_replies_count_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_replies_count_del AFTER DELETE ON public.forum_replies FOR EACH ROW EXECUTE FUNCTION public.bump_post_count();


--
-- Name: forum_replies trg_replies_count_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_replies_count_ins AFTER INSERT ON public.forum_replies FOR EACH ROW EXECUTE FUNCTION public.bump_post_count();


--
-- Name: forum_replies trg_replies_set_author; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_replies_set_author BEFORE INSERT ON public.forum_replies FOR EACH ROW EXECUTE FUNCTION public.set_author_id();


--
-- Name: dm_messages dm_messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_messages
    ADD CONSTRAINT dm_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: dm_messages dm_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_messages
    ADD CONSTRAINT dm_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.dm_threads(id) ON DELETE CASCADE;


--
-- Name: dm_participants dm_participants_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.dm_threads(id) ON DELETE CASCADE;


--
-- Name: dm_participants dm_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_participants
    ADD CONSTRAINT dm_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: forum_categories forum_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT forum_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: forum_categories forum_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT forum_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.forum_categories(id) ON DELETE CASCADE;


--
-- Name: forum_posts forum_posts_author_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_author_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: forum_posts forum_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: forum_posts forum_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.forum_categories(id) ON DELETE CASCADE;


--
-- Name: forum_replies forum_replies_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT forum_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: forum_replies forum_replies_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT forum_replies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forum_posts(id) ON DELETE CASCADE;


--
-- Name: frames frames_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frames
    ADD CONSTRAINT frames_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: item_votes item_votes_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_votes
    ADD CONSTRAINT item_votes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: item_votes item_votes_voter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_votes
    ADD CONSTRAINT item_votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: items_images items_images_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items_images
    ADD CONSTRAINT items_images_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: items items_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: orders orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: orders orders_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: orders orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dm_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_messages dm_msg_del; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_msg_del ON public.dm_messages FOR DELETE USING ((author_id = auth.uid()));


--
-- Name: dm_messages dm_msg_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_msg_ins ON public.dm_messages FOR INSERT WITH CHECK (((author_id = auth.uid()) AND public.is_dm_participant(thread_id, auth.uid())));


--
-- Name: dm_messages dm_msg_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_msg_sel ON public.dm_messages FOR SELECT USING (public.is_dm_participant(thread_id, auth.uid()));


--
-- Name: dm_participants dm_part_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_part_ins ON public.dm_participants FOR INSERT WITH CHECK (((user_id = auth.uid()) OR public.is_dm_participant(thread_id, auth.uid())));


--
-- Name: dm_participants dm_part_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_part_sel ON public.dm_participants FOR SELECT USING (public.is_dm_participant(thread_id, auth.uid()));


--
-- Name: dm_participants dm_part_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_part_upd ON public.dm_participants FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: dm_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: dm_threads dm_threads_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_threads_ins ON public.dm_threads FOR INSERT WITH CHECK (true);


--
-- Name: dm_threads dm_threads_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_threads_sel ON public.dm_threads FOR SELECT USING (public.is_dm_participant(id, auth.uid()));


--
-- Name: forum_categories forum cats read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum cats read" ON public.forum_categories FOR SELECT USING (true);


--
-- Name: forum_categories forum cats write mods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum cats write mods" ON public.forum_categories TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text)))));


--
-- Name: forum_posts forum posts delete own or mod; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum posts delete own or mod" ON public.forum_posts FOR DELETE TO authenticated USING (((author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text))))));


--
-- Name: forum_posts forum posts insert by subs+; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum posts insert by subs+" ON public.forum_posts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['subscriber'::text, 'moderator'::text]))))));


--
-- Name: forum_posts forum posts read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum posts read" ON public.forum_posts FOR SELECT USING (true);


--
-- Name: forum_replies forum replies delete own or mod; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum replies delete own or mod" ON public.forum_replies FOR DELETE TO authenticated USING (((author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text))))));


--
-- Name: forum_replies forum replies insert any auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum replies insert any auth" ON public.forum_replies FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: forum_replies forum replies read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "forum replies read" ON public.forum_replies FOR SELECT USING (true);


--
-- Name: forum_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: frames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;

--
-- Name: frames frames_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY frames_owner_delete ON public.frames FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'owner'::text)))));


--
-- Name: frames frames_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY frames_owner_update ON public.frames FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'owner'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'owner'::text)))));


--
-- Name: frames frames_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY frames_owner_write ON public.frames FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'owner'::text)))));


--
-- Name: frames frames_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY frames_read_all ON public.frames FOR SELECT USING (true);


--
-- Name: item_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.item_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

--
-- Name: items items delete owner or mod; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items delete owner or mod" ON public.items FOR DELETE TO authenticated USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text))))));


--
-- Name: items items insert owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items insert owner" ON public.items FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: items items read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items read all" ON public.items FOR SELECT USING (true);


--
-- Name: items items update owner or mod; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items update owner or mod" ON public.items FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text)))))) WITH CHECK (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text))))));


--
-- Name: items items: delete owner or elevated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items: delete owner or elevated" ON public.items FOR DELETE USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'moderator'::text])))))));


--
-- Name: items items: update owner or elevated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items: update owner or elevated" ON public.items FOR UPDATE USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'moderator'::text]))))))) WITH CHECK ((owner_id = owner_id));


--
-- Name: items_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.items_images ENABLE ROW LEVEL SECURITY;

--
-- Name: items_images items_images: delete owner or elevated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items_images: delete owner or elevated" ON public.items_images FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = items_images.item_id) AND ((i.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'moderator'::text]))))))))));


--
-- Name: items_images items_images: insert owner or elevated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items_images: insert owner or elevated" ON public.items_images FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = items_images.item_id) AND ((i.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'moderator'::text]))))))))));


--
-- Name: items_images items_images: update owner or elevated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "items_images: update owner or elevated" ON public.items_images FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = items_images.item_id) AND ((i.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'moderator'::text])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = items_images.item_id) AND ((i.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'moderator'::text]))))))))));


--
-- Name: profiles moderators update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "moderators update any profile" ON public.profiles FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles pr
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'moderator'::text)))));


--
-- Name: frames mods manage frames; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mods manage frames" ON public.frames TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles pr
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'moderator'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles pr
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'moderator'::text)))));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert ON public.orders FOR INSERT WITH CHECK ((auth.uid() = buyer_id));


--
-- Name: orders orders_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_read ON public.orders FOR SELECT USING (((auth.uid() = buyer_id) OR (auth.uid() = seller_id)));


--
-- Name: orders orders_update_buyer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update_buyer ON public.orders FOR UPDATE USING ((auth.uid() = buyer_id)) WITH CHECK ((auth.uid() = buyer_id));


--
-- Name: orders orders_update_seller; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update_seller ON public.orders FOR UPDATE USING ((auth.uid() = seller_id)) WITH CHECK ((auth.uid() = seller_id));


--
-- Name: items_images owner manage images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manage images" ON public.items_images TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = items_images.item_id) AND ((i.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = items_images.item_id) AND ((i.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = auth.uid()) AND (p.role = 'moderator'::text)))))))));


--
-- Name: items owners delete items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners delete items" ON public.items FOR DELETE TO authenticated USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles pr
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'moderator'::text))))));


--
-- Name: items owners insert items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners insert items" ON public.items FOR INSERT TO authenticated WITH CHECK (((owner_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.profiles pr
  WHERE ((pr.id = auth.uid()) AND (pr.role = ANY (ARRAY['subscriber'::text, 'moderator'::text]))))) OR (( SELECT count(*) AS count
   FROM public.items it
  WHERE (it.owner_id = auth.uid())) < 5))));


--
-- Name: items owners update items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners update items" ON public.items FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles pr
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'moderator'::text))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: frames public read frames; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read frames" ON public.frames FOR SELECT USING (true);


--
-- Name: items_images public read item images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read item images" ON public.items_images FOR SELECT USING (true);


--
-- Name: item_votes public read item_votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read item_votes" ON public.item_votes FOR SELECT USING (true);


--
-- Name: items public read items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read items" ON public.items FOR SELECT USING (true);


--
-- Name: profiles public read profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read profiles" ON public.profiles FOR SELECT USING (true);


--
-- Name: items_images read item_images for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read item_images for all" ON public.items_images FOR SELECT USING (true);


--
-- Name: items read items for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read items for all" ON public.items FOR SELECT USING (true);


--
-- Name: profiles read profiles for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read profiles for all" ON public.profiles FOR SELECT USING (true);


--
-- Name: item_votes user deletes own vote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user deletes own vote" ON public.item_votes FOR DELETE TO authenticated USING ((voter_id = auth.uid()));


--
-- Name: item_votes user inserts own vote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user inserts own vote" ON public.item_votes FOR INSERT TO authenticated WITH CHECK ((voter_id = auth.uid()));


--
-- Name: profiles user inserts themself; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user inserts themself" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles user updates own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: item_votes user updates own vote; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user updates own vote" ON public.item_votes FOR UPDATE TO authenticated USING ((voter_id = auth.uid())) WITH CHECK ((voter_id = auth.uid()));


--
-- Name: profiles user updates self profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user updates self profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles user updates themself; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user updates themself" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- PostgreSQL database dump complete
--

\unrestrict ECCvmEEKAa7z5OjevFweLJ4mq4D98gr9dzB7L091VQGj5u6b4klRCkPUMzhoULk

