-- Marketplace order-intent boundary. Settlement must be performed by a trusted server process.
begin;

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
for insert
with check (
  auth.uid() = buyer_id
  and buyer_id <> seller_id
  and price_usdc > 0
  and currency = 'USDC'
  and method = 'USDC_BASE'
  and status = 'pending'
  and tx_hash is null
  and chain_id is null
);

commit;
