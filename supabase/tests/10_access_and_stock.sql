\set ON_ERROR_STOP 0
-- helpers to act as a user
create or replace function pg_temp.act(u text) returns void language plpgsql as $$
begin
  if u is null then perform set_config('request.jwt.claim.sub', '', false);
  else perform set_config('request.jwt.claim.sub', u, false); end if;
end $$;

-- ===== data as the bot (service_role) =====
set role service_role;
select id as ys from stores where slug='yasmeen-home' \gset
insert into stores (slug,name,order_ref_prefix) values ('other-shop','متجر تاني','OT') returning id as os \gset
insert into store_members values (:'os','00000000-0000-0000-0000-0000000000c1','owner');
insert into store_members values (:'ys','00000000-0000-0000-0000-0000000000b2','staff');
update stores set inventory_mode='quantity' where id=:'ys';
insert into products (store_id,external_id,name,price) values (:'ys','2056','طقم طناجر دبابة 5 قطع',200) returning id as p1 \gset
insert into product_variants (store_id,product_id,external_id,label,price,stock_qty) values (:'ys',:'p1','v1','بني',200,5) returning id as v1 \gset
insert into product_variants (store_id,product_id,external_id,label,price) values (:'ys',:'p1','v2','أسود',200) returning id as v2 \gset
insert into orders (store_id,ref,idempotency_key,customer_name,customer_phone,city,subtotal,delivery_fee) values (:'ys','YH-1','k1','سماح','0599123456','نابلس',600,20) returning id as o1 \gset
insert into order_items (store_id,order_id,product_id,variant_id,product_name,quantity,unit_price) values (:'ys',:'o1',:'p1',:'v1','طقم',2,200),(:'ys',:'o1',:'p1',:'v2','طقم',1,200);
insert into orders (store_id,ref,customer_name,customer_phone,subtotal) values (:'os','OT-1','x','0500000000',50);
select 'T0 duplicate idempotency blocked' as test;
insert into orders (store_id,ref,idempotency_key,customer_name,customer_phone,subtotal) values (:'ys','YH-2','k1','a','1',1);
select 'order total generated' as test, total from orders where id=:'o1';
reset role;

-- ===== anon =====
set role anon; select pg_temp.act(null);
select 'T1 anon reads orders (expect permission denied)' as test;
select count(*) from orders;
reset role;

-- ===== staff of Yasmeen =====
set role authenticated; select pg_temp.act('00000000-0000-0000-0000-0000000000b2');
select 'T2 staff sees own orders only' as test, count(*) from orders;
select 'T3 staff edits zones (expect 0 rows updated)' as test; update delivery_zones set fee=1; 
select 'T3b fee unchanged' as test, min(fee) from delivery_zones;
select 'T4 staff confirms order -> stock 5-2=3, v2 (not counted) stays null' as test;
update orders set status='confirmed' where ref='YH-1';
select label, stock_qty, out_of_stock from product_variants order by label;
select 'T5 shipped does not take stock twice' as test; update orders set status='shipped' where ref='YH-1';
select label, stock_qty from product_variants where external_id='v1';
select 'T6 cancel gives stock back' as test; update orders set status='cancelled' where ref='YH-1';
select label, stock_qty from product_variants where external_id='v1';
select 'T7 history' as test, string_agg(coalesce(from_status,'-')||'>'||to_status, ', ' order by id), bool_and(changed_by is not null or from_status is null) from order_status_history;
select 'T8 restock 1 by staff' as test; insert into inventory_movements (store_id,variant_id,delta,reason) values (:'ys',:'v1',1,'restock');
select stock_qty from product_variants where external_id='v1';
select 'T9 staff fakes order_confirmed movement (expect RLS error)' as test; insert into inventory_movements (store_id,variant_id,delta,reason) values (:'ys',:'v1',-1,'order_confirmed');
select 'T10 staff marks product out of stock (allowed)' as test; update products set out_of_stock=true where external_id='2056'; select out_of_stock from products;
select 'T11 staff cannot see llm_usage/admin overview' as test; select count(*) from llm_usage; select * from admin_store_overview();
select 'T12 my_stores' as test; select name, role from my_stores();
select 'T13 stats' as test, store_stats(:'ys', now()-interval '30 days');
reset role;

-- ===== owner of Yasmeen =====
set role authenticated; select pg_temp.act('00000000-0000-0000-0000-0000000000b1');
select 'T14 owner edits zone fee' as test; update delivery_zones set fee=25 where name='الضفة'; select fee from delivery_zones where name='الضفة';
update delivery_zones set fee=20 where name='الضفة';
select 'T15 owner changes subscription (expect error)' as test; update stores set status='active' where slug='yasmeen-home';
select 'T16 owner renames store (allowed)' as test; update stores set brand_color='#B7790F' where slug='yasmeen-home';
reset role;

-- ===== owner of other store =====
set role authenticated; select pg_temp.act('00000000-0000-0000-0000-0000000000c1');
select 'T17 other owner sees' as test, (select count(*) from orders) orders, (select count(*) from products) products, (select count(*) from delivery_zones) zones;
select 'T18 other owner puts item into Yasmeen order using own store_id (expect FK error)' as test;
insert into order_items (store_id,order_id,product_name,quantity,unit_price) values (:'os',:'o1','hack',1,1);
select 'T19 other owner inserts row with Yasmeen store_id (expect RLS error)' as test;
insert into messages (store_id,conversation_id,role,text) values (:'ys',gen_random_uuid(),'staff','x');
select 'T20 add member to Yasmeen (expect error)' as test; select add_store_member(:'ys','owner@other.com');
reset role;

-- ===== platform admin =====
set role authenticated; select pg_temp.act('00000000-0000-0000-0000-00000000000a');
select 'T21 admin sees all stores' as test, count(*) from stores;
select 'T22 admin overview' as test; select name, status, orders_30d, orders_value_30d, channels_connected from admin_store_overview();
select 'T23 admin activates subscription' as test; update stores set status='active' where slug='yasmeen-home'; select status from stores where slug='yasmeen-home';
select 'T24 admin_create_store' as test, admin_create_store('متجر تجربة','test-shop','TS','owner@other.com') is not null;
select 'T24b defaults created' as test, (select count(*) from store_policies), (select count(*) from bot_settings);
reset role;
