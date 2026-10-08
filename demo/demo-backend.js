/* BẢN DEMO — thay Supabase bằng dữ liệu mẫu lưu trong trình duyệt.
   Luật nghiệp vụ chép theo schema.sql để demo chạy giống bản thật. */
(function () {
  'use strict';
  const KEY = 'rsdh.demo.v1';
  const D = 864e5, now = () => Date.now(), iso = t => new Date(t).toISOString();
  const uid = () => 'u' + Math.random().toString(36).slice(2, 10);
  const code6 = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fail = m => { const e = new Error(m); e.message = m; throw e; };

  function seed() {
    const t = now();
    const users = [
      { id: 'u-cuong', email: 'cuong@shopgiadung.vn', is_anonymous: false, user_metadata: { name: 'Cường' } },
      { id: 'u-lan', email: null, is_anonymous: true, user_metadata: { name: 'Lan' } },
      { id: 'u-tu', email: null, is_anonymous: true, user_metadata: { name: 'Tú' } },
      { id: 'u-anh', email: 'anh.mebe@gmail.com', is_anonymous: false, user_metadata: { name: 'Ánh' } }
    ];
    const shops = [
      { id: 's-gdc', name: 'Gia Dụng Cường', phone: '0901 234 567', code: 'GDC7K2', plan: 'trial', paid_until: iso(t + 9 * D), overdue_days: 14, created_by: 'u-cuong', created_at: iso(t - 5 * D) },
      { id: 's-mb', name: 'Mẹ Bé Ánh Dương', phone: '0938 111 222', code: 'MB4X9Q', plan: 'basic', paid_until: iso(t + 5 * D), overdue_days: 10, created_by: 'u-anh', created_at: iso(t - 60 * D) }
    ];
    const members = [
      { shop_id: 's-gdc', user_id: 'u-cuong', role: 'owner', display_name: 'Cường', created_at: iso(t - 5 * D) },
      { shop_id: 's-gdc', user_id: 'u-lan', role: 'staff', display_name: 'Lan', created_at: iso(t - 4 * D) },
      { shop_id: 's-mb', user_id: 'u-anh', role: 'owner', display_name: 'Ánh', created_at: iso(t - 60 * D) },
      { shop_id: 's-mb', user_id: 'u-tu', role: 'staff', display_name: 'Tú', created_at: iso(t - 50 * D) }
    ];
    const prods = ['Nồi chiên không dầu 6L', 'Máy xay sinh tố mini', 'Bộ dao inox 5 món', 'Ấm siêu tốc 1.8L', 'Chảo chống dính 28cm', 'Hộp cơm giữ nhiệt'];
    const carriers = ['SPX Express', 'GHN', 'J&T Express'];
    const names = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E'];
    const returns = [];
    for (let i = 0; i < 46; i++) {
      const days = Math.floor(i * 0.62);
      const c = i % 3 === 0 ? 'SPXVN04' + (8277160 + i * 37) : i % 3 === 1 ? 'GHN5K' + (2810 + i * 7) + 'X' : 'JT08' + (38841203 + i * 11);
      const r = { shop_id: 's-gdc', code: c, order_no: '2410' + (55120 + i * 3), product: prods[i % 6], customer: names[i % 5], carrier: carriers[i % 3],
        return_date: iso(t - days * D).slice(0, 10), listed: true, imported_at: iso(t - Math.min(days, 5) * D), scanned_at: null, scanned_by: null, scanned_by_name: null, complaint_at: null, updated_at: iso(t) };
      if (i % 5 === 0 || i % 7 === 0) { r.scanned_at = iso(t - Math.max(0, days - 2) * D - 3600e3 * (i % 9)); r.scanned_by = i % 2 ? 'u-lan' : 'u-cuong'; r.scanned_by_name = i % 2 ? 'Lan' : 'Cường'; }
      if (i === 27 || i === 26) r.complaint_at = iso(t - D);
      returns.push(r);
    }
    returns.push({ shop_id: 's-gdc', code: '851234567890', listed: false, scanned_at: iso(t - 2 * 3600e3), scanned_by: 'u-lan', scanned_by_name: 'Lan', updated_at: iso(t) });
    for (let i = 0; i < 30; i++) returns.push({ shop_id: 's-mb', code: 'SPXVN09' + (1000000 + i), listed: true, imported_at: iso(t - 3 * D), scanned_at: i % 2 ? iso(t - D) : null, updated_at: iso(t) });
    return {
      session: 'u-cuong',
      users, shops, members, returns, admins: ['u-cuong'],
      plans: [
        { id: 'trial', name: 'Dùng thử', price_month: 0, price_year: 0, max_members: 3, max_returns_month: 300, sort: 0 },
        { id: 'basic', name: 'Cơ bản', price_month: 199000, price_year: 1990000, max_members: 5, max_returns_month: 2000, sort: 1 },
        { id: 'pro', name: 'Chuyên nghiệp', price_month: 399000, price_year: 3990000, max_members: null, max_returns_month: null, sort: 2 }
      ],
      invites: [], payments: [
        { id: 1, shop_id: 's-mb', plan: 'basic', months: 1, amount: 199000, memo: 'RSDH MB4X9Q CB01', status: 'confirmed', created_at: iso(t - 25 * D), confirmed_at: iso(t - 25 * D) },
        { id: 2, shop_id: 's-mb', plan: 'basic', months: 1, amount: 199000, memo: 'RSDH MB4X9Q CB01', status: 'pending', created_at: iso(t - 2 * 3600e3) }
      ], nextPay: 3
    };
  }
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !db.users) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  save();

  const me = () => db.users.find(u => u.id === db.session) || null;
  const meId = () => db.session;
  const roleIn = shop => { const m = db.members.find(x => x.shop_id === shop && x.user_id === meId()); return m ? m.role : null; };
  const rank = r => ({ owner: 3, manager: 2, staff: 1 }[r] || 0);
  const req = (shop, min) => { const r = roleIn(shop); if (!r) fail('Bạn không thuộc shop này.'); if (rank(r) < rank(min)) fail('Bạn không có quyền làm việc này.'); return r; };
  const shopOf = id => db.shops.find(s => s.id === id);
  const activeShop = id => Date.parse(shopOf(id).paid_until) > now();
  const reqActive = id => { if (!activeShop(id)) { const e = new Error('Gói của shop đã hết hạn. Chủ shop cần gia hạn để tiếp tục.'); e.hint = 'expired'; throw e; } };
  const isAdmin = () => db.admins.includes(meId());
  const planOf = id => db.plans.find(p => p.id === shopOf(id).plan);
  const seats = id => { const max = planOf(id).max_members; if (max != null && db.members.filter(m => m.shop_id === id).length >= max) fail(`Gói hiện tại cho tối đa ${max} tài khoản. Nâng cấp gói để thêm người.`); };
  const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addMonths = (t, m) => { const d = new Date(t); d.setMonth(d.getMonth() + m); return d.getTime(); };

  // ---- RLS đơn giản: dòng nào người đang đăng nhập được thấy
  const visible = {
    plans: () => db.plans,
    shops: () => db.shops.filter(s => roleIn(s.id) || isAdmin()),
    members: () => db.members.filter(m => roleIn(m.shop_id) || isAdmin()),
    invites: () => db.invites.filter(i => rank(roleIn(i.shop_id)) >= 2),
    returns: () => db.returns.filter(r => rank(roleIn(r.shop_id)) >= 2),
    payments: () => db.payments.filter(p => roleIn(p.shop_id) === 'owner' || isAdmin()),
    admins: () => db.admins.filter(a => a === meId()).map(a => ({ user_id: a }))
  };

  function query(table) {
    const filters = []; let op = 'select', patch = null, head = false, wantCount = false, single = false, embed = false, from = 0, to = null, lim = null, ord = null;
    const q = {
      select(cols, o) { embed = /shops\(/.test(cols || ''); if (o && o.head) head = true; if (o && o.count) wantCount = true; return q; },
      eq(k, v) { filters.push(r => r[k] === v); return q; },
      is(k, v) { filters.push(r => (r[k] == null) === (v == null)); return q; },
      gt(k, v) { filters.push(r => r[k] != null && r[k] > v); return q; },
      gte(k, v) { filters.push(r => r[k] != null && r[k] >= v); return q; },
      order(k, o) { ord = [k, !(o && o.ascending === false)]; return q; },
      range(a, b) { from = a; to = b; return q; },
      limit(n) { lim = n; return q; },
      maybeSingle() { single = true; return q; },
      update(p) { op = 'update'; patch = p; return q; },
      delete() { op = 'delete'; return q; },
      then(res, rej) {
        try {
          if (!meId() && table !== 'plans') return res({ data: single ? null : [], error: null, count: 0 });
          let rows = visible[table]().filter(r => filters.every(f => f(r)));
          if (op === 'update') {
            if (table === 'shops') { rows = rows.filter(s => roleIn(s.id) === 'owner'); for (const s of rows) for (const k of ['name', 'phone', 'overdue_days']) if (k in patch) s[k] = patch[k]; }
            if (table === 'members') { rows = rows.filter(m => m.user_id === meId()); for (const m of rows) if ('display_name' in patch) m.display_name = patch.display_name; }
            save(); return res({ data: null, error: null });
          }
          if (op === 'delete') {
            let del = [];
            if (table === 'members') del = rows.filter(m => roleIn(m.shop_id) === 'owner' && m.role !== 'owner');
            if (table === 'invites' || table === 'returns') del = rows;
            db[table] = db[table].filter(r => !del.includes(r)); save();
            return res({ data: null, error: null });
          }
          if (ord) rows = rows.slice().sort((a, b) => (a[ord[0]] > b[ord[0]] ? 1 : a[ord[0]] < b[ord[0]] ? -1 : 0) * (ord[1] ? 1 : -1));
          const count = rows.length;
          if (to != null) rows = rows.slice(from, to + 1);
          if (lim != null) rows = rows.slice(0, lim);
          if (table === 'admins') rows = rows.map(a => a);
          let data = JSON.parse(JSON.stringify(rows));
          if (embed && table === 'members') data = data.map(m => Object.assign(m, { shops: JSON.parse(JSON.stringify(shopOf(m.shop_id))) }));
          res({ data: head ? null : single ? (data[0] || null) : data, error: null, count });
        } catch (e) { res({ data: null, error: { message: e.message } }); }
      }
    };
    return q;
  }

  const rpcs = {
    create_shop(a) {
      const u = me(); if (!u) fail('Bạn cần đăng nhập.'); if (u.is_anonymous) fail('Tài khoản nhân viên không tạo được shop. Hãy đăng ký bằng email.');
      if (!String(a.p_name || '').trim()) fail('Nhập tên shop.');
      const id = 's-' + uid();
      db.shops.push({ id, name: a.p_name.trim().slice(0, 80), phone: (a.p_phone || '').trim() || null, code: code6(), plan: 'trial', paid_until: iso(now() + 14 * D), overdue_days: 14, created_by: u.id, created_at: iso(now()) });
      db.members.push({ shop_id: id, user_id: u.id, role: 'owner', display_name: (a.p_display_name || '').trim() || 'Chủ shop', created_at: iso(now()) });
      return id;
    },
    create_invite(a) {
      const r = req(a.p_shop, 'manager');
      if (!['manager', 'staff'].includes(a.p_role)) fail('Vai trò không hợp lệ.');
      if (a.p_role === 'manager' && r !== 'owner') fail('Chỉ chủ shop mời được quản lý.');
      seats(a.p_shop);
      const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      db.invites.push({ token, shop_id: a.p_shop, role: a.p_role, created_by: meId(), created_at: iso(now()), expires_at: iso(now() + 7 * D), used_at: null });
      return token;
    },
    invite_info(a) {
      const i = db.invites.find(x => x.token === a.p_token); if (!i) return null;
      return { shop_name: shopOf(i.shop_id).name, role: i.role, valid: !i.used_at && Date.parse(i.expires_at) > now() };
    },
    accept_invite(a) {
      if (!meId()) fail('Bạn cần đăng nhập.');
      const i = db.invites.find(x => x.token === a.p_token);
      if (!i || i.used_at || Date.parse(i.expires_at) < now()) fail('Link mời đã dùng hoặc hết hạn. Xin chủ shop link mới.');
      if (roleIn(i.shop_id)) return i.shop_id;
      seats(i.shop_id);
      db.members.push({ shop_id: i.shop_id, user_id: meId(), role: i.role, display_name: (a.p_display_name || '').trim().slice(0, 40) || 'Nhân viên', created_at: iso(now()) });
      i.used_at = iso(now()); i.used_by = meId();
      return i.shop_id;
    },
    scan_code(a) {
      req(a.p_shop, 'staff'); reqActive(a.p_shop);
      const c = norm(a.p_code); if (c.length < 4 || c.length > 40) fail('Mã không hợp lệ: ' + c);
      const name = db.members.find(m => m.shop_id === a.p_shop && m.user_id === meId()).display_name;
      let r = db.returns.find(x => x.shop_id === a.p_shop && x.code === c), by = 'code';
      if (!r) { r = db.returns.find(x => x.shop_id === a.p_shop && x.listed && x.order_no && norm(x.order_no) === c); if (r) by = 'order_no'; }
      if (r) {
        if (r.scanned_at) return { status: 'dup', row: r, matched_by: by };
        Object.assign(r, { scanned_at: iso(now()), scanned_by: meId(), scanned_by_name: name, updated_at: iso(now()) });
        return { status: 'ok', row: r, matched_by: by };
      }
      r = { shop_id: a.p_shop, code: c, listed: false, scanned_at: iso(now()), scanned_by: meId(), scanned_by_name: name, updated_at: iso(now()) };
      db.returns.push(r); return { status: 'stray', row: r };
    },
    unscan(a) {
      const role = req(a.p_shop, 'staff'); const c = norm(a.p_code);
      const r = db.returns.find(x => x.shop_id === a.p_shop && x.code === c);
      if (!r || !r.scanned_at) return false;
      if (role === 'staff' && (r.scanned_by !== meId() || Date.parse(r.scanned_at) < now() - 30 * 60e3)) fail('Nhân viên chỉ hủy được lần quét của mình trong 30 phút.');
      if (r.listed) Object.assign(r, { scanned_at: null, scanned_by: null, scanned_by_name: null }); else db.returns = db.returns.filter(x => x !== r);
      return true;
    },
    scan_stats(a) {
      req(a.p_shop, 'staff'); const d = new Date(); d.setHours(0, 0, 0, 0); const st = d.getTime();
      const rs = db.returns.filter(r => r.shop_id === a.p_shop && r.scanned_at && Date.parse(r.scanned_at) >= st);
      return { mine_today: rs.filter(r => r.scanned_by === meId()).length, shop_today: rs.length };
    },
    import_returns(a) {
      req(a.p_shop, 'manager'); reqActive(a.p_shop);
      if (!Array.isArray(a.p_rows) || a.p_rows.length > 2000) fail('Mỗi lần gửi tối đa 2000 dòng.');
      const src = new Map();
      for (const x of a.p_rows) { const c = norm(x.code); if (c.length >= 4 && c.length <= 40 && !src.has(c)) src.set(c, x); }
      const existing = c => db.returns.find(r => r.shop_id === a.p_shop && r.code === c);
      const fresh = [...src.keys()].filter(c => { const r = existing(c); return !r || !r.listed; }).length;
      const max = planOf(a.p_shop).max_returns_month;
      if (max != null) {
        const used = db.returns.filter(r => r.shop_id === a.p_shop && r.listed && r.imported_at && Date.parse(r.imported_at) >= monthStart()).length;
        if (used + fresh > max) fail(`Gói hiện tại cho nhập tối đa ${max} đơn mới mỗi tháng (đã dùng ${used}, file này thêm ${fresh}).`);
      }
      for (const [c, x] of src) {
        const f = { order_no: x.order_no || null, product: x.product || null, customer: x.customer || null, carrier: x.carrier || null, return_date: /^\d{4}-\d{2}-\d{2}$/.test(x.return_date || '') ? x.return_date : null };
        const r = existing(c);
        if (r) { for (const k in f) if (f[k]) r[k] = f[k]; if (!r.listed) r.imported_at = iso(now()); r.listed = true; r.updated_at = iso(now()); }
        else db.returns.push(Object.assign({ shop_id: a.p_shop, code: c, listed: true, imported_at: iso(now()), scanned_at: null, complaint_at: null, updated_at: iso(now()) }, f));
      }
      return { total: src.size, new: fresh };
    },
    set_complaint(a) {
      req(a.p_shop, 'manager'); const r = db.returns.find(x => x.shop_id === a.p_shop && x.code === norm(a.p_code));
      if (!r) return false; r.complaint_at = a.p_on ? iso(now()) : null; return true;
    },
    create_payment(a) {
      req(a.p_shop, 'owner');
      if (!['basic', 'pro'].includes(a.p_plan) || ![1, 12].includes(a.p_months)) fail('Gói không hợp lệ.');
      const p = db.plans.find(x => x.id === a.p_plan); const amount = a.p_months === 1 ? p.price_month : p.price_year;
      if (!(amount > 0)) fail('Gói này chưa có giá. Liên hệ hỗ trợ để đăng ký.');
      db.payments.forEach(x => { if (x.shop_id === a.p_shop && x.status === 'pending') x.status = 'cancelled'; });
      const row = { id: db.nextPay++, shop_id: a.p_shop, plan: a.p_plan, months: a.p_months, amount, memo: `RSDH ${shopOf(a.p_shop).code} ${a.p_plan === 'basic' ? 'CB' : 'CN'}${String(a.p_months).padStart(2, '0')}`, status: 'pending', created_by: meId(), created_at: iso(now()) };
      db.payments.push(row); return row;
    },
    admin_confirm_payment(a) {
      if (!isAdmin()) fail('Chỉ quản trị viên.');
      const p = db.payments.find(x => x.id === a.p_id); if (!p || p.status !== 'pending') fail('Khoản này đã xử lý rồi.');
      p.status = 'confirmed'; p.confirmed_at = iso(now());
      const s = shopOf(p.shop_id); s.plan = p.plan; s.paid_until = iso(addMonths(Math.max(Date.parse(s.paid_until), now()), p.months));
      return s;
    },
    admin_cancel_payment(a) { if (!isAdmin()) fail('Chỉ quản trị viên.'); const p = db.payments.find(x => x.id === a.p_id && x.status === 'pending'); if (p) p.status = 'cancelled'; return !!p; },
    admin_extend(a) { if (!isAdmin()) fail('Chỉ quản trị viên.'); const s = shopOf(a.p_shop); s.paid_until = iso(Math.max(Date.parse(s.paid_until), now()) + a.p_days * D); return s.paid_until; },
    admin_set_plan(a) { if (!isAdmin()) fail('Chỉ quản trị viên.'); shopOf(a.p_shop).plan = a.p_plan; return true; },
    admin_overview() {
      if (!isAdmin()) fail('Chỉ quản trị viên.');
      return {
        shops: db.shops.map(s => ({ ...s, owner_email: (db.users.find(u => u.id === s.created_by) || {}).email, owner_name: (db.members.find(m => m.shop_id === s.id && m.role === 'owner') || {}).display_name,
          members: db.members.filter(m => m.shop_id === s.id).length,
          returns_month: db.returns.filter(r => r.shop_id === s.id && r.listed && r.imported_at && Date.parse(r.imported_at) >= monthStart()).length,
          last_scan: db.returns.filter(r => r.shop_id === s.id && r.scanned_at).map(r => r.scanned_at).sort().pop() || null })).sort((x, y) => y.created_at.localeCompare(x.created_at)),
        pending: db.payments.filter(p => p.status === 'pending').map(p => ({ ...p, shop_name: shopOf(p.shop_id).name })),
        revenue_month: db.payments.filter(p => p.status === 'confirmed' && Date.parse(p.confirmed_at) >= monthStart()).reduce((s, p) => s + p.amount, 0)
      };
    }
  };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.supabase = {
    createClient() {
      return {
        auth: {
          async getSession() { const u = me(); return { data: { session: u ? { user: JSON.parse(JSON.stringify(u)) } : null } }; },
          onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
          async signInWithPassword({ email }) {
            await wait(250);
            const u = db.users.find(x => x.email && x.email.toLowerCase() === String(email).trim().toLowerCase());
            if (!u) return { data: null, error: { message: 'Invalid login credentials' } };
            db.session = u.id; save(); return { data: { session: { user: u } }, error: null };
          },
          async signUp({ email, options }) {
            await wait(300);
            if (db.users.some(x => x.email && x.email.toLowerCase() === String(email).trim().toLowerCase())) return { data: {}, error: { message: 'User already registered' } };
            const u = { id: uid(), email: String(email).trim(), is_anonymous: false, user_metadata: (options && options.data) || {} };
            db.users.push(u); db.session = u.id; save(); return { data: { session: { user: u }, user: u }, error: null };
          },
          async signInAnonymously(o) { await wait(200); const u = { id: uid(), email: null, is_anonymous: true, user_metadata: (o && o.options && o.options.data) || {} }; db.users.push(u); db.session = u.id; save(); return { data: { user: u, session: { user: u } }, error: null }; },
          async signOut() { db.session = null; save(); return { error: null }; },
          async updateUser() { return { data: {}, error: null }; },
          async resetPasswordForEmail() { await wait(200); return { data: {}, error: null }; }
        },
        from: query,
        async rpc(name, args) {
          await wait(name === 'scan_code' ? 160 : 120);
          try { const data = rpcs[name](args || {}); save(); return { data: JSON.parse(JSON.stringify(data === undefined ? null : data)), error: null }; }
          catch (e) { return { data: null, error: { message: e.message, hint: e.hint } }; }
        }
      };
    }
  };

  // ---- thanh công cụ demo ----
  window.DEMO_API = {
    reset() { db = seed(); save(); },
    as(id) { db.session = id; save(); },
    sampleCodes() {
      const shop = (db.members.find(m => m.user_id === meId()) || {}).shop_id;
      const open = db.returns.filter(r => r.shop_id === shop && r.listed && !r.scanned_at).slice(-3).map(r => ({ code: r.code, label: r.code }));
      const done = db.returns.find(r => r.shop_id === shop && r.listed && r.scanned_at);
      return open.concat(done ? [{ code: done.code, label: done.code + ' (trùng)' }] : [], [{ code: 'LAZ' + (100000 + Math.floor(Math.random() * 899999)), label: 'Mã lạ' }]);
    }
  };
})();
