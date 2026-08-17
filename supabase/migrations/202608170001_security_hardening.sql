-- Security hardening: constrain identity and payment-bearing writes.
-- Apply after reviewing the live schema snapshot.

begin;

-- Replies must be authored by the authenticated user represented by the row.
drop policy if exists "forum replies insert any auth" on public.forum_replies;
create policy "forum replies insert own author"
  on public.forum_replies
  for insert
  to authenticated
  with check (author_id = auth.uid());

-- Orders may not have their identity or settlement basis rewritten by clients.
create or replace function public.prevent_order_identity_rewrite()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.item_id is distinct from old.item_id
     or new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.price_usdc is distinct from old.price_usdc
     or new.currency is distinct from old.currency
     or new.method is distinct from old.method
     or new.tx_hash is distinct from old.tx_hash
     or new.chain_id is distinct from old.chain_id then
    raise exception 'order identity and settlement fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_prevent_identity_rewrite on public.orders;
create trigger orders_prevent_identity_rewrite
before update on public.orders
for each row execute function public.prevent_order_identity_rewrite();

commit;
