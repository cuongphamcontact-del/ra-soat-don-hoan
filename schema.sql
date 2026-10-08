-- =====================================================================
--  RÀ SOÁT ĐƠN HOÀN — cơ sở dữ liệu cho Supabase
--  Cách dùng: Supabase → SQL Editor → New query → dán toàn bộ file → Run.
--  Chạy lại nhiều lần cũng được (không xóa dữ liệu đã có).
-- =====================================================================

-- ---------- Bảng ----------------------------------------------------

create or replace function public.gen_code(n int) returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, n)
$$;

create table if not exists public.plans (
  id                text primary key,
  name              text not null,
  price_month       bigint not null default 0,   -- giá 1 tháng (đồng). 0 = chưa bán
  price_year        bigint not null default 0,   -- giá 12 tháng (đồng)
  max_members       int,                         -- số tài khoản tối đa / shop. Trống = không giới hạn
  max_returns_month int,                         -- số đơn hoàn nhập mới tối đa / tháng. Trống = không giới hạn
  sort              int not null default 0
);

insert into public.plans (id, name, price_month, price_year, max_members, max_returns_month, sort) values
  ('trial', 'Dùng thử',      0, 0, 3,    300,  0),
  ('basic', 'Cơ bản',        0, 0, 5,    2000, 1),
  ('pro',   'Chuyên nghiệp', 0, 0, null, null, 2)
on conflict (id) do nothing;

create table if not exists public.shops (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  phone        text check (phone is null or char_length(phone) <= 30),
  code         text not null unique default public.gen_code(6),   -- mã shop, dùng trong nội dung chuyển khoản
  plan         text not null default 'trial' references public.plans(id),
  paid_until   timestamptz not null default now() + interval '14 days',
  overdue_days int not null default 14 check (overdue_days between 1 and 120),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.members (
  shop_id      uuid not null references public.shops(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner', 'manager', 'staff')),
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at   timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists members_user_idx on public.members(user_id);

create table if not exists public.invites (
  token      text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  role       text not null check (role in ('manager', 'staff')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz
);

create table if not exists public.returns (
  shop_id         uuid not null references public.shops(id) on delete cascade,
  code            text not null,                 -- mã vận đơn (chữ in hoa, không khoảng trắng)
  order_no        text,
  product         text,
  customer        text,
  carrier         text,
  return_date     date,
  listed          boolean not null default true, -- false = hàng lạ: quét được nhưng không có trong danh sách
  imported_at     timestamptz,
  scanned_at      timestamptz,
  scanned_by      uuid references auth.users(id) on delete set null,
  scanned_by_name text,
  complaint_at    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (shop_id, code)
);
create index if not exists returns_scanned_idx on public.returns(shop_id, scanned_at);

create table if not exists public.payments (
  id           bigint generated always as identity primary key,
  shop_id      uuid not null references public.shops(id) on delete cascade,
  plan         text not null check (plan in ('basic', 'pro')),
  months       int not null check (months in (1, 12)),
  amount       bigint not null check (amount > 0),
  memo         text not null,
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists payments_shop_idx on public.payments(shop_id, created_at desc);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ---------- Hàm kiểm tra quyền -------------------------------------

create or replace function public.my_role(p_shop uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from members where shop_id = p_shop and user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

create or replace function public.shop_active(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select paid_until > now() from shops where id = p_shop), false)
$$;

create or replace function public._require(p_shop uuid, p_min text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  r text := my_role(p_shop);
begin
  if r is null then
    raise exception 'Bạn không thuộc shop này.' using errcode = '42501';
  end if;
  if (case r when 'owner' then 3 when 'manager' then 2 else 1 end)
   < (case p_min when 'owner' then 3 when 'manager' then 2 else 1 end) then
    raise exception 'Bạn không có quyền làm việc này.' using errcode = '42501';
  end if;
  return r;
end $$;

create or replace function public._require_active(p_shop uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not shop_active(p_shop) then
    raise exception 'Gói của shop đã hết hạn. Chủ shop cần gia hạn để tiếp tục.' using errcode = 'P0001', hint = 'expired';
  end if;
end $$;

create or replace function public._check_seats(p_shop uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_max int;
  v_cnt int;
begin
  select p.max_members into v_max from shops s join plans p on p.id = s.plan where s.id = p_shop;
  if v_max is null then return; end if;
  select count(*) into v_cnt from members where shop_id = p_shop;
  if v_cnt >= v_max then
    raise exception 'Gói hiện tại cho tối đa % tài khoản. Nâng cấp gói để thêm người.', v_max using errcode = 'P0001';
  end if;
end $$;

create or replace function public._is_anonymous() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- ---------- Chức năng: shop & thành viên ---------------------------

create or replace function public.create_shop(p_name text, p_phone text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'Bạn cần đăng nhập.' using errcode = '42501'; end if;
  if _is_anonymous() then raise exception 'Tài khoản nhân viên không tạo được shop. Hãy đăng ký bằng email.' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nhập tên shop.'; end if;
  if (select count(*) from members where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'Mỗi tài khoản tạo tối đa 5 shop.';
  end if;
  insert into shops (name, phone, created_by)
    values (left(trim(p_name), 80), nullif(left(trim(coalesce(p_phone, '')), 30), ''), v_uid)
    returning id into v_id;
  insert into members (shop_id, user_id, role, display_name)
    values (v_id, v_uid, 'owner', coalesce(nullif(left(trim(coalesce(p_display_name, '')), 40), ''), 'Chủ shop'));
  return v_id;
end $$;

create or replace function public.create_invite(p_shop uuid, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare
  r text := _require(p_shop, 'manager');
  v_tok text;
begin
  if p_role not in ('manager', 'staff') then raise exception 'Vai trò không hợp lệ.'; end if;
  if p_role = 'manager' and r <> 'owner' then raise exception 'Chỉ chủ shop mời được quản lý.' using errcode = '42501'; end if;
  perform _check_seats(p_shop);
  insert into invites (shop_id, role, created_by) values (p_shop, p_role, auth.uid()) returning token into v_tok;
  return v_tok;
end $$;

create or replace function public.invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'shop_name', s.name,
           'role', i.role,
           'valid', i.used_at is null and i.expires_at > now())
  from invites i join shops s on s.id = i.shop_id
  where i.token = p_token
$$;

create or replace function public.accept_invite(p_token text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  inv invites%rowtype;
begin
  if v_uid is null then raise exception 'Bạn cần đăng nhập.' using errcode = '42501'; end if;
  select * into inv from invites where token = p_token for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'Link mời đã dùng hoặc hết hạn. Xin chủ shop link mới.';
  end if;
  if exists (select 1 from members where shop_id = inv.shop_id and user_id = v_uid) then
    return inv.shop_id;
  end if;
  perform _check_seats(inv.shop_id);
  insert into members (shop_id, user_id, role, display_name)
    values (inv.shop_id, v_uid, inv.role, coalesce(nullif(left(trim(coalesce(p_display_name, '')), 40), ''), 'Nhân viên'));
  update invites set used_by = v_uid, used_at = now() where token = p_token;
  return inv.shop_id;
end $$;

-- ---------- Chức năng: quét & đơn hoàn -----------------------------

create or replace function public._norm_code(p text) returns text
language sql immutable as $$
  -- chỉ giữ chữ và số: bỏ dấu #, khoảng trắng, gạch ngang… để "#802834050343" khớp với mã vạch "802834050343"
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.scan_code(p_shop uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text := _norm_code(p_code);
  v_name text;
  v_by   text := 'code';
  v_row  returns%rowtype;
begin
  perform _require(p_shop, 'staff');
  perform _require_active(p_shop);
  if length(v_code) < 4 or length(v_code) > 40 then raise exception 'Mã không hợp lệ: %', v_code; end if;
  select display_name into v_name from members where shop_id = p_shop and user_id = auth.uid();

  select * into v_row from returns where shop_id = p_shop and code = v_code for update;
  if not found then
    -- quét nhầm mã đơn hàng: tìm theo cột mã đơn hàng trong danh sách
    select * into v_row from returns
     where shop_id = p_shop and listed and order_no is not null and _norm_code(order_no) = v_code
     order by scanned_at nulls first limit 1 for update;
    if found then v_by := 'order_no'; end if;
  end if;
  if found then
    if v_row.scanned_at is not null then
      return jsonb_build_object('status', 'dup', 'row', to_jsonb(v_row), 'matched_by', v_by);
    end if;
    update returns set scanned_at = now(), scanned_by = auth.uid(), scanned_by_name = v_name, updated_at = now()
      where shop_id = p_shop and code = v_row.code returning * into v_row;
    return jsonb_build_object('status', 'ok', 'row', to_jsonb(v_row), 'matched_by', v_by);
  end if;

  insert into returns (shop_id, code, listed, scanned_at, scanned_by, scanned_by_name)
    values (p_shop, v_code, false, now(), auth.uid(), v_name)
    on conflict (shop_id, code) do nothing
    returning * into v_row;
  if not found then  -- người khác vừa quét cùng mã
    select * into v_row from returns where shop_id = p_shop and code = v_code;
    return jsonb_build_object('status', 'dup', 'row', to_jsonb(v_row));
  end if;
  return jsonb_build_object('status', 'stray', 'row', to_jsonb(v_row));
end $$;

create or replace function public.unscan(p_shop uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  r text := _require(p_shop, 'staff');
  v_row returns%rowtype;
begin
  select * into v_row from returns where shop_id = p_shop and code = _norm_code(p_code) for update;
  if not found or v_row.scanned_at is null then return false; end if;
  if r = 'staff' and (v_row.scanned_by is distinct from auth.uid() or v_row.scanned_at < now() - interval '30 minutes') then
    raise exception 'Nhân viên chỉ hủy được lần quét của mình trong 30 phút.' using errcode = '42501';
  end if;
  if v_row.listed then
    update returns set scanned_at = null, scanned_by = null, scanned_by_name = null, updated_at = now()
      where shop_id = p_shop and code = v_row.code;
  else
    delete from returns where shop_id = p_shop and code = v_row.code;
  end if;
  return true;
end $$;

create or replace function public.scan_stats(p_shop uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_start timestamptz := date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
begin
  perform _require(p_shop, 'staff');
  return jsonb_build_object(
    'mine_today', (select count(*) from returns where shop_id = p_shop and scanned_by = auth.uid() and scanned_at >= v_start),
    'shop_today', (select count(*) from returns where shop_id = p_shop and scanned_at >= v_start));
end $$;

create or replace function public.import_returns(p_shop uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_max   int;
  v_used  int;
  v_new   int;
  v_total int;
begin
  perform _require(p_shop, 'manager');
  perform _require_active(p_shop);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'Mỗi lần gửi tối đa 2000 dòng.';
  end if;

  drop table if exists _src;
  create temp table _src on commit drop as
  select distinct on (code) code, order_no, product, customer, carrier, return_date
  from (
    select _norm_code(x ->> 'code') as code,
           left(nullif(trim(x ->> 'order_no'), ''), 60)  as order_no,
           left(nullif(trim(x ->> 'product'), ''), 120)  as product,
           left(nullif(trim(x ->> 'customer'), ''), 60)  as customer,
           left(nullif(trim(x ->> 'carrier'), ''), 40)   as carrier,
           case when (x ->> 'return_date') ~ '^\d{4}-\d{2}-\d{2}$' then (x ->> 'return_date')::date end as return_date
    from jsonb_array_elements(p_rows) x
  ) t
  where length(code) between 4 and 40;

  select count(*) into v_new from _src s
   where not exists (select 1 from returns r where r.shop_id = p_shop and r.code = s.code and r.listed);

  select p.max_returns_month into v_max from shops sh join plans p on p.id = sh.plan where sh.id = p_shop;
  if v_max is not null then
    select count(*) into v_used from returns
     where shop_id = p_shop and listed and imported_at >= date_trunc('month', now());
    if v_used + v_new > v_max then
      raise exception 'Gói hiện tại cho nhập tối đa % đơn mới mỗi tháng (đã dùng %, file này thêm %).', v_max, v_used, v_new using errcode = 'P0001';
    end if;
  end if;

  insert into returns as r (shop_id, code, order_no, product, customer, carrier, return_date, listed, imported_at)
  select p_shop, code, order_no, product, customer, carrier, return_date, true, now() from _src
  on conflict (shop_id, code) do update set
    order_no    = coalesce(excluded.order_no, r.order_no),
    product     = coalesce(excluded.product, r.product),
    customer    = coalesce(excluded.customer, r.customer),
    carrier     = coalesce(excluded.carrier, r.carrier),
    return_date = coalesce(excluded.return_date, r.return_date),
    imported_at = case when r.listed then r.imported_at else now() end,
    listed      = true,
    updated_at  = now();
  get diagnostics v_total = row_count;
  return jsonb_build_object('total', v_total, 'new', v_new);
end $$;

create or replace function public.set_complaint(p_shop uuid, p_code text, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform _require(p_shop, 'manager');
  update returns set complaint_at = case when p_on then now() end, updated_at = now()
   where shop_id = p_shop and code = _norm_code(p_code);
  return found;
end $$;

-- ---------- Chức năng: thanh toán ----------------------------------

create or replace function public.create_payment(p_shop uuid, p_plan text, p_months int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_amount bigint;
  v_code   text;
  v_row    payments%rowtype;
begin
  perform _require(p_shop, 'owner');
  if p_plan not in ('basic', 'pro') or p_months not in (1, 12) then raise exception 'Gói không hợp lệ.'; end if;
  select case p_months when 1 then price_month else price_year end into v_amount from plans where id = p_plan;
  if coalesce(v_amount, 0) <= 0 then raise exception 'Gói này chưa có giá. Liên hệ hỗ trợ để đăng ký.'; end if;
  select code into v_code from shops where id = p_shop;
  update payments set status = 'cancelled' where shop_id = p_shop and status = 'pending';
  insert into payments (shop_id, plan, months, amount, memo, created_by)
    values (p_shop, p_plan, p_months, v_amount,
            'RSDH ' || v_code || ' ' || (case p_plan when 'basic' then 'CB' else 'CN' end) || lpad(p_months::text, 2, '0'),
            auth.uid())
    returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- ---------- Chức năng: quản trị (chỉ admin) ------------------------

create or replace function public._require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Chỉ quản trị viên.' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_confirm_payment(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p payments%rowtype;
  s shops%rowtype;
begin
  perform _require_admin();
  select * into p from payments where id = p_id for update;
  if not found or p.status <> 'pending' then raise exception 'Khoản này đã xử lý rồi.'; end if;
  update payments set status = 'confirmed', confirmed_at = now() where id = p_id;
  update shops set plan = p.plan,
                   paid_until = greatest(paid_until, now()) + make_interval(months => p.months)
   where id = p.shop_id returning * into s;
  return to_jsonb(s);
end $$;

create or replace function public.admin_cancel_payment(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update payments set status = 'cancelled' where id = p_id and status = 'pending';
  return found;
end $$;

create or replace function public.admin_extend(p_shop uuid, p_days int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  perform _require_admin();
  if p_days = 0 or abs(p_days) > 3660 then raise exception 'Số ngày không hợp lệ.'; end if;
  update shops set paid_until = greatest(paid_until, now()) + make_interval(days => p_days)
   where id = p_shop returning paid_until into v;
  return v;
end $$;

create or replace function public.admin_set_plan(p_shop uuid, p_plan text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update shops set plan = p_plan where id = p_shop;
  return found;
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_admin();
  return jsonb_build_object(
    'shops', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select s.id, s.name, s.phone, s.code, s.plan, s.paid_until, s.created_at,
               (select u.email from auth.users u where u.id = s.created_by) as owner_email,
               (select m.display_name from members m where m.shop_id = s.id and m.role = 'owner' limit 1) as owner_name,
               (select count(*) from members m where m.shop_id = s.id) as members,
               (select count(*) from returns r where r.shop_id = s.id and r.listed and r.imported_at >= date_trunc('month', now())) as returns_month,
               (select max(r.scanned_at) from returns r where r.shop_id = s.id) as last_scan
        from shops s
      ) x), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'shop_id', p.shop_id, 'shop_name', s.name, 'plan', p.plan,
                                          'months', p.months, 'amount', p.amount, 'memo', p.memo, 'created_at', p.created_at)
                       order by p.created_at)
      from payments p join shops s on s.id = p.shop_id where p.status = 'pending'), '[]'::jsonb),
    'revenue_month', (select coalesce(sum(amount), 0) from payments where status = 'confirmed' and confirmed_at >= date_trunc('month', now()))
  );
end $$;

-- Chuẩn hoá mã cũ (chạy lại an toàn)
update public.returns r set code = public._norm_code(r.code)
 where r.code <> public._norm_code(r.code)
   and not exists (select 1 from public.returns x where x.shop_id = r.shop_id and x.code = public._norm_code(r.code));

-- ---------- Bảo mật dòng (RLS) -------------------------------------

alter table public.plans    enable row level security;
alter table public.shops    enable row level security;
alter table public.members  enable row level security;
alter table public.invites  enable row level security;
alter table public.returns  enable row level security;
alter table public.payments enable row level security;
alter table public.admins   enable row level security;

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (true);

drop policy if exists shops_read on public.shops;
create policy shops_read on public.shops for select using (my_role(id) is not null or is_admin());
drop policy if exists shops_owner_update on public.shops;
create policy shops_owner_update on public.shops for update using (my_role(id) = 'owner') with check (my_role(id) = 'owner');

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (my_role(shop_id) is not null or is_admin());
drop policy if exists members_owner_delete on public.members;
create policy members_owner_delete on public.members for delete using (my_role(shop_id) = 'owner' and role <> 'owner');
drop policy if exists members_self_update on public.members;
create policy members_self_update on public.members for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select using (my_role(shop_id) in ('owner', 'manager'));
drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete using (my_role(shop_id) in ('owner', 'manager'));

drop policy if exists returns_read on public.returns;
create policy returns_read on public.returns for select using (my_role(shop_id) in ('owner', 'manager'));
drop policy if exists returns_delete on public.returns;
create policy returns_delete on public.returns for delete using (my_role(shop_id) in ('owner', 'manager'));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select using (my_role(shop_id) = 'owner' or is_admin());

drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select using (user_id = auth.uid());

-- Quyền đọc/xóa (RLS ở trên quyết định dòng nào được thấy)
grant usage on schema public to anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.shops, public.members, public.invites, public.returns, public.payments, public.admins to authenticated;
grant delete on public.members, public.invites, public.returns to authenticated;
revoke delete on public.shops, public.payments, public.admins, public.plans from anon, authenticated;

-- Chỉ cho sửa đúng các cột an toàn
revoke update on public.shops from anon, authenticated;
grant  update (name, phone, overdue_days) on public.shops to authenticated;
revoke update on public.members from anon, authenticated;
grant  update (display_name) on public.members to authenticated;
revoke insert, update on public.returns, public.payments, public.invites, public.admins, public.plans from anon, authenticated;
revoke insert on public.shops, public.members from anon, authenticated;

-- Quyền gọi hàm
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'gen_code','my_role','is_admin','shop_active','_require','_require_active','_check_seats','_is_anonymous',
      'create_shop','create_invite','invite_info','accept_invite','_norm_code','scan_code','unscan','scan_stats',
      'import_returns','set_complaint','create_payment','_require_admin','admin_confirm_payment',
      'admin_cancel_payment','admin_extend','admin_set_plan','admin_overview')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
grant execute on function public.invite_info(text) to anon;
