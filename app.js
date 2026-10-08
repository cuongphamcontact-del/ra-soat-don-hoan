/* Rà Soát Đơn Hoàn — web app điện thoại
   Không cần sửa file này. Cài đặt nằm trong config.js. */
(function () {
'use strict';

// ---------- tiện ích -----------------------------------------------------
const C = window.APP_CONFIG || {};
const APP = C.APP_NAME || 'Rà Soát Đơn Hoàn';
const app = document.getElementById('app');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const norm = s => String(s == null ? '' : s).replace(/[\s\u0000-\u001f\u007f]/g, '').toUpperCase();
const DAY = 864e5;
const vnd = n => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const nf = n => Number(n || 0).toLocaleString('vi-VN');
const p2 = n => String(n).padStart(2, '0');
const fmtDate = t => { if (!t) return ''; const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtDT = t => { if (!t) return ''; const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const ROLE = { owner: 'Chủ shop', manager: 'Quản lý', staff: 'Nhân viên kho' };
const PLAN_FALLBACK = { trial: 'Dùng thử', basic: 'Cơ bản', pro: 'Chuyên nghiệp' };

const ICON = {
  scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  import: 'M12 15V4M7 9l5-5 5 5M4 15v5h16v-5',
  staff: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.7-3.4 3.3-5.5 6.5-5.5s5.8 2.1 6.5 5.5M16 4.5a3.3 3.3 0 0 1 0 6.3M18.5 14.8c1.6.8 2.7 2.5 3 5.2',
  billing: 'M3 6h18v12H3zM3 10h18M7 15h4',
  torch: 'M9 2h6l-1 6h4l-8 14 2-10H7z',
  cam: 'M3 8h3.5l2-3h7l2 3H21v11H3zM12 16.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z',
  back: 'M15 5l-7 7 7 7',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'
};
const svg = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500); }

function errText(e) {
  if (!e) return 'Có lỗi xảy ra. Thử lại.';
  const m = e.message || String(e);
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Mất kết nối mạng. Kiểm tra mạng rồi thử lại.';
  if (/Invalid login credentials/i.test(m)) return 'Sai email hoặc mật khẩu.';
  if (/already registered|already been registered/i.test(m)) return 'Email này đã có tài khoản. Hãy đăng nhập.';
  if (/Password should be at least/i.test(m)) return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (/Email not confirmed/i.test(m)) return 'Email chưa xác nhận. Mở hộp thư và bấm vào link xác nhận.';
  if (/Anonymous sign-ins are disabled/i.test(m)) return 'Web chưa bật đăng nhập cho nhân viên. Chủ web cần bật "Anonymous sign-ins" trong Supabase.';
  if (/email rate limit/i.test(m)) return 'Hệ thống gửi email xác nhận đã hết lượt trong giờ này. Chủ web cần tắt "Confirm email" trong Supabase (Authentication → Sign In / Providers → Email), hoặc đợi khoảng 1 giờ rồi thử lại.';
  if (/rate limit|too many/i.test(m)) return 'Thao tác quá nhiều lần. Đợi vài phút rồi thử lại.';
  if (/JWT|token is expired/i.test(m)) return 'Phiên đăng nhập hết hạn. Tải lại trang.';
  return m;
}

function twoStep(btn, label, fn) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.old; fn(); return; }
  btn.dataset.armed = '1'; btn.dataset.old = btn.textContent; btn.textContent = label;
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.old; } }, 3500);
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Đã chép: ' + t); }
  catch (e) { toast('Nhấn giữ vào chữ để chép.'); }
}

const scripts = {};
function loadScript(src) {
  if (!scripts[src]) scripts[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete scripts[src]; rej(new Error('Không tải được thư viện. Kiểm tra mạng.')); };
    document.head.appendChild(s);
  });
  return scripts[src];
}

// âm báo + rung
let ac;
function unlockAudio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
document.addEventListener('pointerdown', unlockAudio, { passive: true });
function feedback(kind) {
  const seq = { ok: [[1180, .1]], dup: [[440, .12], [440, .12]], stray: [[760, .08], [560, .08], [760, .08]], err: [[220, .35]] }[kind] || [];
  try {
    unlockAudio();
    if (ac) { let t = ac.currentTime; for (const [f, d] of seq) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d + .05; } }
  } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate({ ok: 60, dup: [60, 60, 60], stray: [200, 80, 200], err: 400 }[kind] || 0); } catch (e) {}
}

// ---------- trạng thái -----------------------------------------------------
let sb = null;
const S = {
  user: null, members: [], me: null, shop: null, role: null, isAdmin: false, plans: [],
  returns: null, returnsAt: 0, recent: [], lastRes: null, stats: null, camOn: false,
  lf: null, lq: '', lLimit: 100, imp: { mode: 'file', parsed: null, map: {} }, inviteRole: 'staff', newInvite: null,
  bc: 'm', bp: 'basic', af: 'all', aq: ''
};
const rank = r => ({ owner: 3, manager: 2, staff: 1 }[r] || 0);
const can = min => rank(S.role) >= rank(min);
const isAnon = () => !!(S.user && S.user.is_anonymous);
const active = () => !!S.shop && new Date(S.shop.paid_until) > new Date();
const daysLeft = () => Math.ceil((new Date(S.shop.paid_until) - Date.now()) / DAY);
const planName = id => (S.plans.find(p => p.id === id) || {}).name || PLAN_FALLBACK[id] || id;
const planOf = id => S.plans.find(p => p.id === id) || {};
const route = () => { const h = location.hash.replace(/^#\/?/, ''); const i = h.indexOf('/'); return i < 0 ? { page: h, arg: '' } : { page: h.slice(0, i), arg: h.slice(i + 1) }; };
const go = p => { if (location.hash === '#/' + p) render(); else location.hash = '#/' + p; };
const replaceTo = p => {
  try { history.replaceState(null, '', location.pathname + location.search + '#/' + p); render(); }
  catch (e) { if (location.hash === '#/' + p) render(); else location.hash = '#/' + p; }
};
const LIB = Object.assign({ qr: 'vendor/html5-qrcode.min.js', xlsx: 'vendor/xlsx.full.min.js' }, C.LIBS || {});
const siteUrl = () => C.PUBLIC_URL || (location.origin + location.pathname);
async function saveBlob(name, blob) {
  if (window.claude && window.claude.use) {
    try { const d = await window.claude.use('downloads'); if (d) { await d.save({ filename: name, data: blob }); return; } }
    catch (e) { if (e && e.code === 'declined') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function configured() {
  const u = C.SUPABASE_URL || '', k = C.SUPABASE_ANON_KEY || '';
  return /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(u) && !/xxxxxxxx/i.test(u) && k.length > 30 && !/DÁN|DAN-KHOA/i.test(k);
}

async function loadPlans() {
  const { data } = await sb.from('plans').select('*').order('sort');
  if (data) S.plans = data;
}

async function loadUser(session) {
  S.user = session ? session.user : null;
  S.members = []; S.me = S.shop = S.role = null; S.isAdmin = false; S.returns = null; S.stats = null;
  if (!S.user) return;
  const [m, a] = await Promise.all([
    sb.from('members').select('shop_id,role,display_name,shops(id,name,code,plan,paid_until,overdue_days,phone)').eq('user_id', S.user.id),
    sb.from('admins').select('user_id').eq('user_id', S.user.id).maybeSingle()
  ]);
  if (m.error) throw m.error;
  S.members = (m.data || []).filter(x => x.shops).sort((x, y) => x.shops.name.localeCompare(y.shops.name));
  S.isAdmin = !!(a && a.data);
  pickShop(store.get('rsdh.shop'));
}

function pickShop(id) {
  const m = S.members.find(x => x.shop_id === id) || S.members[0] || null;
  S.me = m; S.shop = m ? m.shops : null; S.role = m ? m.role : null;
  S.returns = null; S.stats = null; S.recent = []; S.lastRes = null; S.lf = null;
  if (m) store.set('rsdh.shop', m.shop_id);
}

async function refreshShop() {
  if (!S.shop) return;
  const { data } = await sb.from('shops').select('id,name,code,plan,paid_until,overdue_days,phone').eq('id', S.shop.id).maybeSingle();
  if (data) { Object.assign(S.shop, data); }
}

async function afterLogin() {
  const pending = store.get('rsdh.pendingShop');
  if (S.user && !isAnon() && !S.members.length && pending && pending.name) {
    const { error } = await sb.rpc('create_shop', { p_name: pending.name, p_phone: pending.phone || '', p_display_name: pending.display || '' });
    if (!error) { store.del('rsdh.pendingShop'); await loadUser((await sb.auth.getSession()).data.session); }
  }
}

// ---------- khởi động -------------------------------------------------------
async function boot() {
  if (!configured()) { viewSetup(); return; }
  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  sb.auth.onAuthStateChange((ev) => {
    if (ev === 'PASSWORD_RECOVERY') setTimeout(() => replaceTo('reset'), 0);
    if (ev === 'SIGNED_OUT') setTimeout(async () => { await loadUser(null); render(); }, 0);
  });
  try {
    const { data: { session } } = await sb.auth.getSession();
    await Promise.all([loadUser(session), loadPlans()]);
    await afterLogin();
  } catch (e) {
    app.innerHTML = `<div class="page"><div class="center"><b>Không tải được dữ liệu</b><span class="muted">${esc(errText(e))}</span><button class="btn primary" onclick="location.reload()">Tải lại</button></div></div>`;
    return;
  }
  if (location.search && !C.DEMO) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} }
  window.addEventListener('hashchange', render);
  window.RSDH = { async reloadSession(to) { stopCamera(); S.camOn = false; await loadUser((await sb.auth.getSession()).data.session); replaceTo(to || 'scan'); } };
  render();
}

function render() {
  const { page, arg } = route();
  if (page !== 'scan') stopCamera();
  clearInterval(S.poll);
  closeSheet();
  if (page === 'join') return viewJoin(arg);
  if (page === 'reset') return viewReset();
  if (page === 'check') return viewCheck();
  if (!S.user) {
    if (page === 'login') return viewLogin();
    if (page === 'signup') return viewSignup();
    if (page === 'forgot') return viewForgot();
    return viewLanding();
  }
  if (page === 'admin' && S.isAdmin) return viewAdmin();
  if (page === 'new' && !isAnon()) return viewNewShop(!S.members.length);
  if (!S.members.length) return viewNoShop();
  const tabs = tabsFor().map(t => t[0]);
  if (!tabs.includes(page)) return replaceTo('scan');
  ({ scan: viewScan, list: viewList, import: viewImport, staff: viewStaff, billing: viewBilling })[page]();
}

function tabsFor() {
  const t = [['scan', 'Quét']];
  if (can('manager')) t.push(['list', 'Đơn hoàn'], ['import', 'Nhập file']);
  if (can('owner')) t.push(['staff', 'Nhân viên'], ['billing', 'Gói']);
  return t;
}

// ---------- khung app ------------------------------------------------------
function avatarBtn() {
  const n = (S.me && S.me.display_name) || (S.user && S.user.email) || '?';
  return `<button class="iconbtn" id="menuBtn" aria-label="Mở menu"><span class="avatar">${esc(n.trim().charAt(0).toUpperCase())}</span></button>`;
}
function planChip() {
  if (!S.shop) return '';
  if (!active()) return `<a class="pill bad" href="#/${can('owner') ? 'billing' : 'scan'}">Hết hạn</a>`;
  if (can('owner') && daysLeft() <= 5) return `<a class="pill warn" href="#/billing" style="text-decoration:none">Còn ${daysLeft()} ngày</a>`;
  return '';
}
function topbar(title, extra = '') {
  return `<header class="top"><h1 class="disp">${esc(title)}</h1>${extra}${planChip()}${avatarBtn()}</header>`;
}
function shell(head, body, night = false) {
  const { page } = route();
  const tabs = tabsFor();
  app.innerHTML = `<div class="page ${night ? 'night' : ''}">${head}${body}${tabs.length > 1 ? `<nav class="tabs" aria-label="Điều hướng">${tabs.map(([k, l]) => `<a href="#/${k}" class="${k === page ? 'on' : ''}"${k === page ? ' aria-current="page"' : ''}>${svg(ICON[k])}${l}</a>`).join('')}</nav>` : ''}</div>`;
  const mb = $('#menuBtn'); if (mb) mb.onclick = openMenu;
}
const loadingBody = '<main class="content"><div class="center"><div class="spin"></div></div></main>';

// ---------- menu -----------------------------------------------------------
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); }
function sheet(html) {
  closeSheet();
  const d = document.createElement('div'); d.className = 'scrim'; d.id = 'sheet';
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  d.addEventListener('click', e => { if (e.target === d) closeSheet(); });
  document.body.appendChild(d);
  return d;
}
function openMenu() {
  const shops = S.members.length > 1 ? S.members.map(m => `<button class="opt" data-shop="${m.shop_id}"><span style="flex:1">${esc(m.shops.name)}<small>${ROLE[m.role]}</small></span>${S.shop && m.shop_id === S.shop.id ? '<span class="pill ok">Đang dùng</span>' : ''}</button>`).join('') : '';
  const who = isAnon() ? 'Tài khoản nhân viên trên máy này' : esc(S.user.email || '');
  const d = sheet(`
    <div style="padding:4px 4px 10px"><b>${esc((S.me && S.me.display_name) || 'Tài khoản')}</b><div class="muted" style="font-size:13px">${who}</div></div>
    ${shops}
    ${S.isAdmin ? '<a class="opt" href="#/admin">Trang quản trị</a>' : ''}
    ${!isAnon() ? '<a class="opt" href="#/new">Tạo thêm shop</a>' : ''}
    <button class="opt" id="optInstall">Cài lên màn hình chính<small>Mở nhanh như một app</small></button>
    <a class="opt" href="#/check">Kiểm tra lỗi<small>Dùng khi quét hoặc đăng nhập không được</small></a>
    ${C.SUPPORT_ZALO ? `<button class="opt" id="optZalo">Hỗ trợ qua Zalo<small>${esc(C.SUPPORT_ZALO)}</small></button>` : ''}
    <button class="opt" id="optOut" style="color:var(--bad)">Đăng xuất</button>`);
  $$('[data-shop]', d).forEach(b => b.onclick = () => { pickShop(b.dataset.shop); closeSheet(); replaceTo('scan'); });
  $('#optInstall', d).onclick = installHelp;
  const z = $('#optZalo', d); if (z) z.onclick = () => copyText(C.SUPPORT_ZALO);
  $('#optOut', d).onclick = e => {
    if (isAnon()) twoStep(e.currentTarget, 'Bấm lần nữa · sẽ cần link mời mới', logout);
    else logout();
  };
}
async function logout() { closeSheet(); stopCamera(); S.camOn = false; await sb.auth.signOut(); await loadUser(null); replaceTo(''); }
function installHelp() {
  sheet(`<div class="stack" style="padding:4px">
    <b class="disp" style="font-size:24px">Cài lên màn hình chính</b>
    <div class="note"><b>iPhone (Safari):</b> bấm nút Chia sẻ <span class="mono">⬆︎</span> ở thanh dưới → <b>Thêm vào MH chính</b>.</div>
    <div class="note"><b>Android (Chrome):</b> bấm <span class="mono">⋮</span> góc trên → <b>Thêm vào màn hình chính</b> hoặc <b>Cài đặt ứng dụng</b>.</div>
    <span class="muted" style="font-size:13px">Sau đó mở bằng biểu tượng trên màn hình, không cần gõ địa chỉ web.</span>
    <button class="btn block" onclick="document.getElementById('sheet').remove()">Đóng</button></div>`);
}

// ---------- kiểm tra lỗi -------------------------------------------------------
async function viewCheck() {
  stopCamera();
  app.innerHTML = `<div class="page"><header class="top"><a class="iconbtn" href="#/scan" aria-label="Quay lại" style="color:inherit">${svg(ICON.back)}</a><h1 class="disp">Kiểm tra lỗi</h1></header>
    <main class="content"><p class="muted" style="margin:0">Chụp màn hình trang này gửi người hỗ trợ.</p><div class="card" id="chk" style="padding:4px 14px"></div>
    <button class="btn primary big" id="camTest">Thử mở camera</button><div id="camRes"></div>
    <div class="card mono" style="font-size:11px;word-break:break-all;color:var(--muted)">${esc(navigator.userAgent)}<br>Bản web: ${esc(document.lastModified)}</div></main></div>`;
  const rows = [];
  const put = (ok, name, detail) => { rows.push(`<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line2)"><b style="color:${ok === true ? 'var(--ok)' : ok === false ? 'var(--bad)' : 'var(--warn)'};width:18px;flex:none">${ok === true ? '✓' : ok === false ? '✗' : '!'}</b><div style="min-width:0"><b>${esc(name)}</b><div class="muted" style="font-size:13px;overflow-wrap:anywhere">${esc(detail || '')}</div></div></div>`); const el = $('#chk'); if (el) el.innerHTML = rows.join(''); };
  const ua = navigator.userAgent;
  const inApp = /Zalo|FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger|TikTok|musical_ly|GSA\/|; wv\)/i.test(ua);
  put(!inApp, 'Trình duyệt', inApp ? 'Đang mở trong trình duyệt của một app (Zalo, Facebook, Gmail…). App này thường chặn camera. Mở bằng Safari hoặc Chrome.' : 'Trình duyệt thường');
  put(window.isSecureContext, 'Kết nối https', window.isSecureContext ? 'Có' : 'Không. Camera chỉ chạy trên https://');
  const hasCam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  put(hasCam, 'Trình duyệt hỗ trợ camera', hasCam ? 'Có' : 'Không. Trình duyệt này không cho web dùng camera.');
  try { await loadScript(LIB.qr); put(!!window.Html5Qrcode, 'Bộ đọc mã vạch', window.Html5Qrcode ? 'Đã tải' : 'Tải xong nhưng không chạy'); }
  catch (e) { put(false, 'Bộ đọc mã vạch', errText(e)); }
  if (!sb) { put(false, 'Cài đặt', 'config.js chưa điền khóa Supabase'); }
  else {
    const p = await sb.from('plans').select('id');
    put(!p.error, 'Kết nối cơ sở dữ liệu', p.error ? (p.error.message + (p.error.code ? ' [' + p.error.code + ']' : '')) : `Có (${(p.data || []).length} gói)`);
    put(!!S.user, 'Đăng nhập', S.user ? (S.user.email || 'Tài khoản nhân viên') + (S.isAdmin ? ' · quản trị' : '') : 'Chưa đăng nhập');
    if (S.user) {
      const m = await sb.from('members').select('shop_id,role').eq('user_id', S.user.id);
      put(!m.error && (m.data || []).length > 0, 'Shop', m.error ? m.error.message : (m.data || []).length ? `${S.shop ? S.shop.name : ''} · ${ROLE[S.role] || ''} · ${active() ? 'còn hạn đến ' + fmtDate(S.shop.paid_until) : 'HẾT HẠN'}` : 'Tài khoản chưa có shop nào');
      if (S.shop) {
        const st = await sb.rpc('scan_stats', { p_shop: S.shop.id });
        put(!st.error, 'Quyền quét', st.error ? st.error.message + (st.error.code ? ' [' + st.error.code + ']' : '') : `Được · hôm nay bạn quét ${st.data.mine_today} đơn`);
      }
    }
  }
  $('#camTest').onclick = async () => {
    const out = $('#camRes');
    if (!hasCam) { out.innerHTML = '<div class="err">Trình duyệt này không có camera cho web.</div>'; return; }
    out.innerHTML = '<div class="note">Đang xin quyền camera…</div>';
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const t = s.getVideoTracks()[0]; const lbl = t ? t.label : '';
      s.getTracks().forEach(x => x.stop());
      out.innerHTML = `<div class="note" style="color:var(--ok)"><b>Camera mở được.</b> ${esc(lbl)}</div>`;
    } catch (e) {
      out.innerHTML = `<div class="err"><b>${esc(e.name || 'Lỗi')}</b>: ${esc(e.message || String(e))}<br>${/NotAllowed/i.test(e.name) ? 'Camera bị từ chối. iPhone: Cài đặt → Safari → Camera → Cho phép. Android: bấm biểu tượng ổ khóa cạnh địa chỉ web → Quyền → Camera.' : ''}</div>`;
    }
  };
}
window.addEventListener('error', e => { try { toast('Lỗi: ' + (e.message || 'không rõ')); } catch (x) {} });
window.addEventListener('unhandledrejection', e => { try { const r = e.reason; toast('Lỗi: ' + errText(r)); } catch (x) {} });

// ---------- trang chưa cài đặt -------------------------------------------
function viewSetup() {
  app.innerHTML = `<div class="page"><div class="center" style="text-align:left;align-items:stretch">
    <b class="disp" style="font-size:32px">Chưa cài đặt xong</b>
    <p>Mở file <span class="mono">config.js</span> và điền <b>SUPABASE_URL</b> cùng <b>SUPABASE_ANON_KEY</b> theo hướng dẫn trong file <span class="mono">HUONG-DAN.md</span>, rồi tải lên lại.</p></div></div>`;
}

// ---------- trang giới thiệu ------------------------------------------------
function viewLanding() {
  const plans = (S.plans.length ? S.plans : [{ id: 'trial' }, { id: 'basic' }, { id: 'pro' }]).map(p => {
    const lim = [p.max_members ? `${p.max_members} tài khoản` : 'Không giới hạn tài khoản', p.max_returns_month ? `${nf(p.max_returns_month)} đơn hoàn/tháng` : 'Không giới hạn đơn'].join(' · ');
    const price = p.id === 'trial' ? '0đ' : (p.price_month > 0 ? vnd(p.price_month) : 'Liên hệ');
    const per = p.id === 'trial' ? '/ 14 ngày' : (p.price_month > 0 ? '/ tháng' : '');
    return `<div class="plan ${p.id === 'basic' ? 'hot' : ''}"><div class="l1"><span class="nm">${esc(planName(p.id))}</span><span><span class="pr">${price}</span> <span style="opacity:.75;font-size:14px">${per}</span></span></div>
      <span style="font-size:14px;opacity:.85">${esc(lim)}</span>
      <a class="btn ${p.id === 'basic' ? 'primary' : ''}" href="#/signup">${p.id === 'trial' ? 'Bắt đầu dùng thử' : 'Dùng thử trước, nâng cấp sau'}</a></div>`;
  }).join('');
  app.innerHTML = `<div class="page">
    <header class="pub-head"><a class="brand" href="#/"><i></i><b>${esc(APP)}</b></a><a class="btn ghost" href="#/login">Đăng nhập</a></header>
    <section class="hero">
      <span class="eyebrow">Cho shop bán trên sàn &amp; ads</span>
      <h1 class="disp">Không còn lạc đơn hoàn</h1>
      <p class="lead">Nhập danh sách đơn hoàn hàng tuần, quét mã vận đơn bằng camera điện thoại khi hàng về kho. Đơn quá hạn chưa về hiện ra ngay để bạn khiếu nại kịp lúc.</p>
      <a class="btn primary big" href="#/signup">Dùng thử 14 ngày miễn phí</a>
      <span class="muted" style="font-size:13px;text-align:center">Không cần thẻ ngân hàng · Không cần cài app</span>
    </section>
    <section class="sec"><h2 class="disp">Ba bước mỗi tuần</h2>
      <div class="step"><span class="n">1</span><div><b>Nhập danh sách đơn hoàn</b><div class="muted">Tải file Excel xuất từ sàn. Đơn cũ và mới đều được, mã trùng tự gộp.</div></div></div>
      <div class="step"><span class="n">2</span><div><b>Quét khi hàng về kho</b><div class="muted">Mở camera điện thoại, đưa mã vạch vào khung là tự ghi nhận. Có tiếng bíp và rung báo kết quả.</div></div></div>
      <div class="step"><span class="n">3</span><div><b>Khiếu nại đơn lạc</b><div class="muted">Đơn quá hạn chưa về gom vào một danh sách. Xuất Excel gửi đơn vị vận chuyển.</div></div></div>
    </section>
    <section class="sec" style="padding-top:0"><h2 class="disp">Làm được gì</h2>
      <div class="tagcloud"><span>Quét bằng camera</span><span>Nhiều nhân viên cùng quét</span><span>Báo quét trùng</span><span>Phát hiện hàng lạ</span><span>Biết ai quét đơn nào</span><span>Xuất Excel</span><span>Dùng được súng quét</span></div>
    </section>
    <section class="sec pricing"><h2 class="disp">Bảng giá</h2><span style="color:#B4BFC9">Tính theo shop. Thanh toán chuyển khoản.</span>${plans}</section>
    <section class="sec faq"><h2 class="disp">Hỏi đáp</h2>
      <details><summary>Có cần cài app không?</summary><p>Không. Mở web trên điện thoại, chọn “Thêm vào màn hình chính” để dùng như app.</p></details>
      <details><summary>File danh sách lấy ở đâu?</summary><p>File xuất đơn hoàn từ Shopee, TikTok Shop, Lazada hoặc đơn vị vận chuyển. Web tự nhận cột mã vận đơn.</p></details>
      <details><summary>Nhân viên kho có cần email không?</summary><p>Không. Chủ shop gửi link mời qua Zalo, nhân viên mở link, nhập tên là quét được.</p></details>
      <details><summary>Hết hạn thì dữ liệu có mất không?</summary><p>Không. Chỉ tạm khóa quét và nhập mới, dữ liệu vẫn xem và xuất được.</p></details>
    </section>
    <footer class="foot">© ${new Date().getFullYear()} ${esc(APP)}${C.COMPANY ? ' · ' + esc(C.COMPANY) : ''}${C.SUPPORT_ZALO ? `<br>Hỗ trợ Zalo: ${esc(C.SUPPORT_ZALO)}` : ''}</footer>
  </div>`;
}

// ---------- đăng nhập / đăng ký --------------------------------------------
function authPage(title, form) {
  app.innerHTML = `<div class="page"><div class="authtop"><a class="brand" href="#/"><i></i><b>${esc(APP)}</b></a><h1 class="disp">${title}</h1></div>${form}</div>`;
}
function busy(btn, on, label) { if (on) { btn.dataset.l = btn.textContent; btn.textContent = label || 'Đang xử lý…'; btn.disabled = true; } else { btn.textContent = btn.dataset.l || btn.textContent; btn.disabled = false; } }

function viewLogin() {
  authPage('Đăng nhập', `<form class="form" id="f" novalidate>
    <label class="field" for="em">Email<input id="em" type="email" autocomplete="email" inputmode="email" required></label>
    <label class="field" for="pw">Mật khẩu<input id="pw" type="password" autocomplete="current-password" required></label>
    <a href="#/forgot" style="align-self:flex-end;font-size:14px">Quên mật khẩu?</a>
    <div id="msg"></div>
    <button class="btn primary big" id="go">Đăng nhập</button>
    <span style="text-align:center" class="muted">Chưa có tài khoản? <a href="#/signup"><b>Dùng thử miễn phí</b></a></span>
    <div class="card" style="font-size:14px;color:var(--ink2)"><b style="color:var(--ink)">Nhân viên kho?</b> Mở link mời chủ shop gửi qua Zalo để vào thẳng màn hình quét.</div>
  </form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const b = $('#go'); busy(b, true); $('#msg').innerHTML = '';
    const { data, error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    if (error) { busy(b, false); $('#msg').innerHTML = `<div class="err">${esc(errText(error))}</div>`; return; }
    try { await loadUser(data.session); await afterLogin(); } catch (er) { busy(b, false); $('#msg').innerHTML = `<div class="err">${esc(errText(er))}</div>`; return; }
    replaceTo('scan');
  };
}

function viewSignup() {
  authPage('Dùng thử 14 ngày', `<form class="form" id="f" novalidate>
    <label class="field" for="nm">Tên của bạn<input id="nm" autocomplete="name" required></label>
    <label class="field" for="shop">Tên shop<input id="shop" required></label>
    <label class="field" for="ph">Số điện thoại / Zalo<input id="ph" type="tel" inputmode="tel" autocomplete="tel"></label>
    <label class="field" for="em">Email<input id="em" type="email" autocomplete="email" inputmode="email" required></label>
    <label class="field" for="pw">Mật khẩu <small>ít nhất 6 ký tự</small><input id="pw" type="password" autocomplete="new-password" minlength="6" required></label>
    <div id="msg"></div>
    <button class="btn primary big" id="go">Tạo shop và dùng thử</button>
    <span style="text-align:center" class="muted">Đã có tài khoản? <a href="#/login"><b>Đăng nhập</b></a></span>
  </form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const msg = $('#msg'); msg.innerHTML = '';
    const name = $('#nm').value.trim(), shop = $('#shop').value.trim(), phone = $('#ph').value.trim(), email = $('#em').value.trim(), pw = $('#pw').value;
    if (!name || !shop || !email || pw.length < 6) { msg.innerHTML = '<div class="err">Điền tên, tên shop, email và mật khẩu (ít nhất 6 ký tự).</div>'; return; }
    const b = $('#go'); busy(b, true);
    store.set('rsdh.pendingShop', { name: shop, phone, display: name });
    const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
    if (error) { busy(b, false); msg.innerHTML = `<div class="err">${esc(errText(error))}</div>`; return; }
    if (!data.session) {
      authPage('Kiểm tra email', `<div class="form"><p class="lead">Mình vừa gửi link xác nhận tới <b>${esc(email)}</b>. Mở email, bấm vào link là shop <b>${esc(shop)}</b> được tạo ngay.</p><span class="muted">Không thấy email? Xem trong mục Thư rác / Quảng cáo.</span><a class="btn" href="#/login">Đã xác nhận, đăng nhập</a></div>`);
      return;
    }
    try { await loadUser(data.session); await afterLogin(); } catch (er) { busy(b, false); msg.innerHTML = `<div class="err">${esc(errText(er))}</div>`; return; }
    toast('Đã tạo shop. Bạn có 14 ngày dùng thử.');
    replaceTo('import');
  };
}

function viewForgot() {
  authPage('Quên mật khẩu', `<form class="form" id="f" novalidate>
    <label class="field" for="em">Email đã đăng ký<input id="em" type="email" autocomplete="email" inputmode="email" required></label>
    <div id="msg"></div><button class="btn primary big" id="go">Gửi link đặt lại mật khẩu</button><a href="#/login" style="text-align:center">Quay lại đăng nhập</a></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const b = $('#go'); busy(b, true);
    const { error } = await sb.auth.resetPasswordForEmail($('#em').value.trim(), { redirectTo: location.origin + location.pathname });
    busy(b, false);
    $('#msg').innerHTML = error ? `<div class="err">${esc(errText(error))}</div>` : '<div class="note">Đã gửi. Mở email và bấm vào link để đặt mật khẩu mới.</div>';
  };
}

function viewReset() {
  authPage('Đặt mật khẩu mới', `<form class="form" id="f" novalidate>
    <label class="field" for="pw">Mật khẩu mới <small>ít nhất 6 ký tự</small><input id="pw" type="password" autocomplete="new-password" minlength="6" required></label>
    <div id="msg"></div><button class="btn primary big" id="go">Lưu mật khẩu</button></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const b = $('#go'); busy(b, true);
    const { error } = await sb.auth.updateUser({ password: $('#pw').value });
    if (error) { busy(b, false); $('#msg').innerHTML = `<div class="err">${esc(errText(error))}</div>`; return; }
    await loadUser((await sb.auth.getSession()).data.session);
    toast('Đã đổi mật khẩu.'); replaceTo('scan');
  };
}

function viewNoShop() {
  if (isAnon()) {
    app.innerHTML = `<div class="page"><div class="center"><b class="disp" style="font-size:30px">Chưa vào shop nào</b><p class="muted">Bạn đã bị xóa khỏi shop hoặc link mời chưa dùng. Xin chủ shop gửi link mời mới.</p><button class="btn" id="out">Đăng xuất</button></div></div>`;
    $('#out').onclick = logout; return;
  }
  viewNewShop(true);
}
function viewNewShop(first) {
  const p = store.get('rsdh.pendingShop', {}) || {};
  authPage(first ? 'Tạo shop' : 'Thêm shop', `<form class="form" id="f" novalidate>
    ${first ? '<p class="muted" style="margin:0">Tài khoản của bạn chưa có shop nào.</p>' : ''}
    <label class="field" for="shop">Tên shop<input id="shop" value="${esc(p.name || '')}" required></label>
    <label class="field" for="ph">Số điện thoại / Zalo<input id="ph" type="tel" value="${esc(p.phone || '')}"></label>
    <label class="field" for="nm">Tên của bạn<input id="nm" value="${esc(p.display || (S.user.user_metadata && S.user.user_metadata.name) || '')}"></label>
    <div id="msg"></div><button class="btn primary big" id="go">Tạo shop</button>
    ${first ? '<button type="button" class="btn ghost" id="out">Đăng xuất</button>' : '<a class="btn ghost" href="#/scan">Hủy</a>'}</form>`);
  const out = $('#out'); if (out) out.onclick = logout;
  $('#f').onsubmit = async e => {
    e.preventDefault(); const b = $('#go'); busy(b, true);
    const { data, error } = await sb.rpc('create_shop', { p_name: $('#shop').value, p_phone: $('#ph').value, p_display_name: $('#nm').value });
    if (error) { busy(b, false); $('#msg').innerHTML = `<div class="err">${esc(errText(error))}</div>`; return; }
    store.del('rsdh.pendingShop');
    await loadUser((await sb.auth.getSession()).data.session); pickShop(data);
    toast('Đã tạo shop.'); replaceTo('import');
  };
}

// ---------- nhận lời mời -----------------------------------------------------
async function viewJoin(token) {
  app.innerHTML = `<div class="page">${loadingBody}</div>`;
  const { data, error } = await sb.rpc('invite_info', { p_token: token || '' });
  if (error || !data) { authPage('Link không đúng', `<div class="form"><p class="lead">Link mời không tồn tại. Kiểm tra lại link chủ shop gửi.</p><a class="btn" href="#/">Về trang chủ</a></div>`); return; }
  if (!data.valid) { authPage('Link đã hết hạn', `<div class="form"><p class="lead">Link mời vào <b>${esc(data.shop_name)}</b> đã được dùng hoặc quá 7 ngày. Xin chủ shop gửi link mới.</p>${S.user ? '<a class="btn" href="#/scan">Vào app</a>' : ''}</div>`); return; }
  const emailUser = S.user && !isAnon();
  authPage('Lời mời', `<form class="form" id="f" novalidate>
    <p class="lead" style="margin:0">Bạn được mời vào shop <b>${esc(data.shop_name)}</b> với vai trò <b>${ROLE[data.role]}</b>.</p>
    ${emailUser ? `<div class="note">Bạn đang đăng nhập bằng <b>${esc(S.user.email)}</b>. Shop sẽ được thêm vào tài khoản này.</div>` : ''}
    <label class="field" for="nm">Tên của bạn <small>chủ shop sẽ thấy tên này khi bạn quét</small><input id="nm" autocomplete="name" value="${esc((S.me && S.me.display_name) || '')}" required></label>
    <div id="msg"></div>
    <button class="btn primary big" id="go">${data.role === 'staff' ? 'Vào quét' : 'Tham gia shop'}</button>
    ${!S.user ? '<span class="muted" style="font-size:13px">Không cần email. Tài khoản được nhớ trên điện thoại này.</span>' : ''}
  </form>`);
  $('#nm').focus();
  $('#f').onsubmit = async e => {
    e.preventDefault(); const name = $('#nm').value.trim(); const msg = $('#msg');
    if (!name) { msg.innerHTML = '<div class="err">Nhập tên của bạn.</div>'; return; }
    const b = $('#go'); busy(b, true);
    if (!S.user) {
      const r = await sb.auth.signInAnonymously({ options: { data: { name } } });
      if (r.error) { busy(b, false); msg.innerHTML = `<div class="err">${esc(errText(r.error))}</div>`; return; }
      S.user = r.data.user;
    }
    const { data: shopId, error: er } = await sb.rpc('accept_invite', { p_token: token, p_display_name: name });
    if (er) { busy(b, false); msg.innerHTML = `<div class="err">${esc(errText(er))}</div>`; return; }
    await loadUser((await sb.auth.getSession()).data.session); pickShop(shopId);
    toast('Đã vào shop ' + data.shop_name);
    replaceTo('scan');
  };
}

// ---------- quét ---------------------------------------------------------------
let scanner = null, camStarting = false, lastCode = '', lastAt = 0;

function viewScan() {
  if (!active()) return viewLocked();
  const head = `<header class="top"><div class="scanhead"><b>${esc(S.shop.name)}</b><span>${esc(S.me.display_name || '')} · ${ROLE[S.role]}</span></div>
    <div class="counter"><b id="cnt" class="num">${S.stats ? S.stats.mine_today : '–'}</b><span>bạn quét hôm nay</span></div>${avatarBtn()}</header>`;
  const body = `<div class="viewer">
      <div id="reader"></div>
      <div class="camstart" id="camstart">
        ${svg(ICON.cam, 44)}
        <span id="camMsg">${C.DEMO ? 'Bản demo trên Claude không được mở camera trực tiếp. Bấm các mã thử bên dưới, hoặc chụp ảnh một tem vận đơn thật. Bản thật trên web của bạn quét liên tục bằng camera.' : 'Đưa mã vạch vận đơn vào khung, web tự ghi nhận. Mỗi lần quét có tiếng bíp và rung.'}</span>
        <button class="btn primary big" id="camBtn"${C.DEMO ? ' hidden' : ''}>Bật camera để quét</button>
        <label class="btn" for="photoIn" style="min-width:220px;background:transparent;color:var(--nightink);border-color:var(--nightline)">Chụp ảnh mã vạch</label>
        <input type="file" id="photoIn" accept="image/*" capture="environment" hidden>
        <div id="photoBox"></div>
        <a href="#/check" style="color:var(--nightmuted);font-size:13px">Không quét được? Bấm để kiểm tra lỗi</a>
      </div>
      <div class="tools"><button id="torchBtn" aria-label="Bật đèn" hidden>${svg(ICON.torch, 20)}</button></div>
      <div class="bottom"><div id="res"></div><div class="recent" id="recent" hidden></div></div>
    </div>
    <form class="manual" id="manual" autocomplete="off"><label class="sr" for="code">Mã vận đơn</label>
      <input id="code" autocapitalize="characters" spellcheck="false" enterkeyhint="done" placeholder="Nhập mã hoặc dùng súng quét">
      <button class="btn primary">Ghi nhận</button></form>
    ${C.DEMO && C.DEMO.sampleCodes ? `<div class="demochips"><span>Thử quét nhanh:</span>${C.DEMO.sampleCodes().map(c => `<button type="button" data-try="${esc(c.code)}">${esc(c.label)}</button>`).join('')}</div>` : ''}
    <div style="height:10px"></div>`;
  shell(head, body, true);
  $('#camBtn').onclick = () => { unlockAudio(); startCamera(); };
  $('#photoIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) scanPhoto(f); };
  $$('[data-try]').forEach(b => b.onclick = () => { unlockAudio(); submitScan(b.dataset.try, true); });
  $('#manual').onsubmit = e => { e.preventDefault(); const i = $('#code'); const v = i.value; i.value = ''; if (v.trim()) submitScan(v, true); };
  $('#torchBtn').onclick = toggleTorch;
  renderRes(); renderRecent();
  sb.rpc('scan_stats', { p_shop: S.shop.id }).then(({ data }) => { if (data) { S.stats = data; const c = $('#cnt'); if (c) c.textContent = data.mine_today; } });
  if (S.camOn) startCamera();
}

function viewLocked() {
  const owner = can('owner');
  shell(topbar('Quét'), `<main class="content"><div class="center">
    <div style="width:64px;height:64px;border-radius:16px;background:var(--warn-bg);display:flex;align-items:center;justify-content:center;color:var(--warn)">${svg('M5 10h14v10H5zM8 10V7a4 4 0 0 1 8 0v3', 32)}</div>
    <b class="disp" style="font-size:34px">${owner ? 'Gói đã hết hạn' : 'Shop tạm dừng quét'}</b>
    <p class="muted" style="margin:0">${owner ? `Hết hạn từ ${fmtDate(S.shop.paid_until)}. Dữ liệu vẫn còn, bạn vẫn xem và xuất Excel được. Gia hạn để quét và nhập tiếp.` : 'Gói của shop đã hết hạn. Báo chủ shop gia hạn để quét tiếp.'}</p>
    ${owner ? '<a class="btn primary big block" href="#/billing">Gia hạn để quét tiếp</a><a class="btn block" href="#/list">Xem danh sách đơn hoàn</a>' : ''}
  </div></main>`);
}

async function startCamera() {
  if (scanner || camStarting) return;
  if (!$('#reader')) return;
  camStarting = true;
  const msg = $('#camMsg'), btn = $('#camBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang mở camera…'; }
  try {
    if (!window.isSecureContext) throw new Error('insecure');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('NotAllowed');
    await loadScript(LIB.qr);
    if (route().page !== 'scan' || !$('#reader')) return;
    const F = window.Html5QrcodeSupportedFormats;
    const s = new window.Html5Qrcode('reader', {
      formatsToSupport: [F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }, verbose: false
    });
    await s.start({ facingMode: 'environment' }, {
      fps: 12, disableFlip: true,
      qrbox: (w, h) => ({ width: Math.max(160, Math.floor(w * 0.86)), height: Math.max(100, Math.floor(Math.min(h * 0.36, w * 0.55))) })
    }, onDecoded, () => {});
    scanner = s; S.camOn = true;
    if (route().page !== 'scan') { stopCamera(); return; }
    const cs = $('#camstart'); if (cs) cs.hidden = true;
    try {
      const tf = s.getRunningTrackCameraCapabilities().torchFeature();
      if (tf.isSupported()) { const tb = $('#torchBtn'); if (tb) tb.hidden = false; }
    } catch (e) {}
  } catch (e) {
    const m = String((e && (e.name || '')) + ' ' + (e && e.message || e));
    let t = 'Không mở được camera. Thử tải lại trang.';
    if (/insecure/.test(m)) t = 'Camera chỉ chạy khi web mở bằng https://';
    else if (C.DEMO) t = 'Bản demo trên Claude không được mở camera trực tiếp. Dùng nút "Chụp ảnh mã vạch" hoặc các mã thử bên dưới. Bản thật trên web của bạn sẽ quét liên tục bằng camera.';
    else if (/NotAllowed|Permission|denied/i.test(m)) t = 'Bạn chưa cho phép dùng camera. Vào cài đặt trình duyệt, cho phép Camera với trang này rồi bấm lại. Hoặc dùng nút "Chụp ảnh mã vạch".';
    else if (/NotFound|no camera|Requested device not found/i.test(m)) t = 'Không tìm thấy camera trên máy này. Dùng ô nhập mã bên dưới.';
    else if (/NotReadable|in use/i.test(m)) t = 'Camera đang bị app khác dùng. Tắt app đó rồi thử lại.';
    else if (/thư viện/.test(m)) t = m;
    if (msg) msg.textContent = t;
    S.camOn = false;
  } finally {
    camStarting = false;
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Bật camera để quét'; }
  }
}
async function scanPhoto(file) {
  const msg = $('#camMsg'); if (msg) msg.textContent = 'Đang đọc mã trong ảnh…';
  try {
    await loadScript(LIB.qr);
    const F = window.Html5QrcodeSupportedFormats;
    const reader = new window.Html5Qrcode('photoBox', { formatsToSupport: [F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX], verbose: false });
    const text = await reader.scanFile(file, false);
    try { reader.clear(); } catch (e) {}
    if (msg) msg.textContent = 'Chụp tiếp gói khác, hoặc bật camera để quét liên tục.';
    submitScan(text, true);
  } catch (e) {
    if (msg) msg.textContent = 'Không đọc được mã trong ảnh. Chụp gần hơn, đủ sáng, mã vạch nằm ngang rồi thử lại.';
    feedback('err');
  }
}
function stopCamera() {
  if (!scanner) return;
  const s = scanner; scanner = null;
  try { s.stop().then(() => { try { s.clear(); } catch (e) {} }).catch(() => {}); } catch (e) {}
  const cs = $('#camstart'); if (cs) cs.hidden = false;
  const tb = $('#torchBtn'); if (tb) { tb.hidden = true; tb.classList.remove('on'); }
}
function toggleTorch() {
  try {
    const tf = scanner.getRunningTrackCameraCapabilities().torchFeature();
    const on = !tf.value(); tf.apply(on).then(() => { $('#torchBtn').classList.toggle('on', on); });
  } catch (e) { toast('Máy này không bật được đèn từ web.'); }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (scanner) { stopCamera(); S.camOn = true; } }
  else if (route().page === 'scan' && S.camOn && active()) startCamera();
});

function onDecoded(text) {
  const code = norm(text);
  if (code.length < 4) return;
  const now = Date.now();
  if (code === lastCode && now - lastAt < 3000) return;
  lastCode = code; lastAt = now;
  submitScan(code);
}

async function submitScan(raw, manual) {
  const code = norm(raw);
  if (code.length < 4 || code.length > 40) { S.lastRes = { kind: 'err', title: 'Mã không hợp lệ', code, meta: 'Mã vận đơn cần từ 4 đến 40 ký tự.' }; renderRes(true); feedback('err'); return; }
  if (manual) { lastCode = code; lastAt = Date.now(); }
  S.lastRes = { kind: 'wait', title: 'Đang ghi nhận…', code, meta: '' }; renderRes();
  const { data, error } = await sb.rpc('scan_code', { p_shop: S.shop.id, p_code: code });
  if (error) {
    const expired = error.hint === 'expired' || /hết hạn/.test(error.message || '');
    S.lastRes = { kind: 'err', title: expired ? 'Gói đã hết hạn' : 'Chưa ghi nhận được', code, meta: errText(error) + (expired ? '' : ' Quét lại mã này.') };
    S.recent.unshift({ code, st: 'err', t: Date.now() }); S.recent = S.recent.slice(0, 4);
    renderRes(true); renderRecent(); feedback('err');
    if (expired) { await refreshShop(); setTimeout(render, 1500); }
    return;
  }
  const st = data.status, r = data.row || {};
  const info = [r.product, r.order_no && 'Đơn ' + r.order_no, r.carrier].filter(Boolean).join(' · ');
  if (st === 'ok') S.lastRes = { kind: 'ok', title: '✓ Đã về kho', code, meta: info || 'Đơn trong danh sách hoàn', undo: true };
  else if (st === 'dup') S.lastRes = { kind: 'dup', title: 'Đã quét trước đó', code, meta: `${r.scanned_by_name || 'Ai đó'} đã quét lúc ${fmtDT(r.scanned_at)}${info ? ' · ' + info : ''}` };
  else S.lastRes = { kind: 'stray', title: 'Không có trong danh sách', code, meta: 'Đã ghi vào mục Hàng lạ để kiểm tra lại.', undo: true };
  S.recent.unshift({ code, st, t: Date.now() }); S.recent = S.recent.slice(0, 4);
  if (st !== 'dup' && S.stats) { S.stats.mine_today++; const c = $('#cnt'); if (c) c.textContent = S.stats.mine_today; }
  S.returns = null;
  renderRes(true); renderRecent(); feedback(st);
}

function renderRes(flash) {
  const el = $('#res'); if (!el) return;
  const r = S.lastRes;
  if (!r) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="result ${r.kind}${flash ? ' flash' : ''}"><span class="big">${esc(r.title)}</span><span class="code">${esc(r.code)}</span>${r.meta ? `<span class="meta">${esc(r.meta)}</span>` : ''}${r.undo ? '<button type="button" id="undo">Hủy lần quét này</button>' : ''}</div>`;
  const u = $('#undo'); if (u) u.onclick = () => undoScan(r.code);
}
function renderRecent() {
  const el = $('#recent'); if (!el) return;
  const rows = S.recent.slice(1);
  el.hidden = !rows.length;
  const L = { ok: 'Về kho', dup: 'Trùng', stray: 'Hàng lạ', err: 'Lỗi' };
  el.innerHTML = rows.map(x => `<div><span class="mono">${esc(x.code)}</span><span class="s-${x.st}">${L[x.st]}</span></div>`).join('');
}
async function undoScan(code) {
  const { error } = await sb.rpc('unscan', { p_shop: S.shop.id, p_code: code });
  if (error) { toast(errText(error)); return; }
  S.recent = S.recent.filter(x => x.code !== code);
  if (S.stats) { S.stats.mine_today = Math.max(0, S.stats.mine_today - 1); const c = $('#cnt'); if (c) c.textContent = S.stats.mine_today; }
  S.lastRes = null; S.returns = null; lastCode = '';
  renderRes(); renderRecent(); toast('Đã hủy lần quét ' + code);
}

// ---------- danh sách đơn hoàn ----------------------------------------------
async function loadReturns(force) {
  if (S.returns && !force && Date.now() - S.returnsAt < 60000) return S.returns;
  let all = [], from = 0; const N = 1000;
  for (;;) {
    const { data, error } = await sb.from('returns').select('code,order_no,product,customer,carrier,return_date,listed,imported_at,scanned_at,scanned_by_name,complaint_at')
      .eq('shop_id', S.shop.id).order('code').range(from, from + N - 1);
    if (error) throw error;
    all = all.concat(data); if (data.length < N) break; from += N;
  }
  S.returns = all; S.returnsAt = Date.now(); return all;
}
function baseTime(r) { if (r.return_date) { const t = Date.parse(r.return_date + 'T00:00:00'); if (!isNaN(t)) return t; } return Date.parse(r.imported_at || r.scanned_at) || Date.now(); }
const ageDays = r => Math.max(0, Math.floor((Date.now() - baseTime(r)) / DAY));
function rstatus(r) { if (!r.listed) return 'la'; if (r.scanned_at) return 've'; if (r.complaint_at) return 'kn'; return ageDays(r) >= S.shop.overdue_days ? 'qua' : 'cho'; }
const ST = { cho: ['Chưa về', 'warn'], qua: ['Quá hạn', 'bad'], kn: ['Khiếu nại', 'kn'], ve: ['Đã về kho', 'ok'], la: ['Hàng lạ', 'stray'] };
const FILTERS = [['cho', 'Chưa về'], ['qua', 'Quá hạn'], ['kn', 'Khiếu nại'], ['ve', 'Đã về'], ['la', 'Hàng lạ'], ['all', 'Tất cả']];
function matchF(r, f) { if (f === 'all') return true; if (f === 'cho') return r.listed && !r.scanned_at; return rstatus(r) === f; }

async function viewList() {
  shell(topbar('Đơn hoàn', `<button class="iconbtn" id="reload" aria-label="Tải lại">${svg(ICON.refresh)}</button>`), loadingBody);
  $('#reload').onclick = () => { S.returns = null; viewList(); };
  let rows;
  try { rows = await loadReturns(); } catch (e) { $('main.content').innerHTML = `<div class="err">${esc(errText(e))}</div>`; return; }
  if (route().page !== 'list') return;
  const n = { cho: 0, qua: 0, kn: 0, ve: 0, la: 0, all: rows.length }, listed = rows.filter(r => r.listed).length;
  for (const r of rows) { const s = rstatus(r); n[s]++; }
  n.cho = rows.filter(r => r.listed && !r.scanned_at).length;
  if (!S.lf) S.lf = n.qua ? 'qua' : 'cho';
  const pct = listed ? Math.round(n.ve / listed * 100) : 0;
  const main = $('main.content');
  if (!rows.length) {
    main.innerHTML = `<div class="center"><b class="disp" style="font-size:28px">Chưa có đơn hoàn</b><p class="muted" style="margin:0">Nhập file danh sách đơn hoàn tuần này để bắt đầu.</p><a class="btn primary big" href="#/import">Nhập file</a></div>`;
    return;
  }
  main.innerHTML = `
    ${!active() ? '<div class="note">Gói đã hết hạn: vẫn xem và xuất được, tạm khóa quét và nhập mới.</div>' : ''}
    <div class="progress"><div class="bar"><b style="width:${pct}%"></b></div><span class="muted num" style="font-size:13px;white-space:nowrap"><b style="color:var(--ink)">${pct}%</b> · ${nf(n.ve)}/${nf(listed)} đã về</span></div>
    <label class="sr" for="q">Tìm đơn</label><input class="input" id="q" type="search" placeholder="Tìm mã vận đơn, sản phẩm, khách…" value="${esc(S.lq)}" style="min-height:44px;background:var(--sunk)">
    <div class="chips" id="chips">${FILTERS.map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${k === S.lf}">${l}<span class="c num">${nf(n[k])}</span></button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;font-size:13px;color:var(--muted)">
      ${can('owner') ? `<label class="row" for="od" style="gap:6px">Quá hạn sau <input id="od" type="number" min="1" max="120" value="${S.shop.overdue_days}" style="width:56px;min-height:36px;border:1px solid var(--field);border-radius:8px;text-align:center;font-size:15px"> ngày</label>` : `<span>Quá hạn sau ${S.shop.overdue_days} ngày</span>`}
      <button class="btn sm" id="xls">Xuất Excel</button></div>
    <div class="stack" id="rows" style="gap:8px"></div>`;
  $$('#chips .chip').forEach(b => b.onclick = () => { S.lf = b.dataset.f; S.lLimit = 100; $$('#chips .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); drawRows(); });
  let qt; $('#q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { S.lq = e.target.value; S.lLimit = 100; drawRows(); }, 200); };
  const od = $('#od'); if (od) od.onchange = async () => {
    const v = Math.max(1, Math.min(120, parseInt(od.value, 10) || 14)); od.value = v;
    const { error } = await sb.from('shops').update({ overdue_days: v }).eq('id', S.shop.id);
    if (error) { toast(errText(error)); return; }
    S.shop.overdue_days = v; S.lf = null; viewList();
  };
  $('#xls').onclick = exportList;
  drawRows();
}
function filtered() {
  const q = fold(S.lq).trim();
  let list = (S.returns || []).filter(r => matchF(r, S.lf) && (!q || fold([r.code, r.order_no, r.product, r.customer, r.carrier].join(' ')).includes(q)));
  if (S.lf === 've' || S.lf === 'la') list.sort((a, b) => Date.parse(b.scanned_at || 0) - Date.parse(a.scanned_at || 0));
  else list.sort((a, b) => (a.scanned_at ? 1 : 0) - (b.scanned_at ? 1 : 0) || baseTime(a) - baseTime(b));
  return list;
}
function drawRows() {
  const el = $('#rows'); if (!el) return;
  const list = filtered();
  if (!list.length) { el.innerHTML = `<div class="card muted">${S.lq ? 'Không có đơn nào khớp từ khóa.' : S.lf === 'qua' ? 'Không có đơn quá hạn.' : 'Không có đơn nào ở mục này.'}</div>`; return; }
  el.innerHTML = list.slice(0, S.lLimit).map(r => {
    const s = rstatus(r), [label, cls] = ST[s];
    const sub = [r.product, r.carrier, r.order_no && 'Đơn ' + r.order_no, r.customer].filter(Boolean).join(' · ') || (r.listed ? 'Chưa có thông tin đơn' : 'Quét được nhưng không có trong file');
    const left = r.scanned_at ? `<span class="muted">Về kho ${fmtDT(r.scanned_at)}${r.scanned_by_name ? ' · ' + esc(r.scanned_by_name) : ''}</span>`
      : `<span class="age ${s === 'qua' ? 'bad' : ''}">${ageDays(r)} ngày chưa về${r.return_date ? ' · ' + fmtDate(r.return_date).slice(0, 5) : ''}</span>`;
    const act = r.scanned_at ? `<button class="btn sm" data-a="unscan" data-c="${esc(r.code)}">Hủy quét</button>`
      : `<button class="btn sm" data-a="${r.complaint_at ? 'unkn' : 'kn'}" data-c="${esc(r.code)}">${r.complaint_at ? 'Bỏ khiếu nại' : 'Khiếu nại'}</button>`;
    return `<div class="item"><div class="l1"><span class="code">${esc(r.code)}</span><span class="pill ${cls}">${label}</span></div><span class="sub">${esc(sub)}</span><div class="l3">${left}${act}</div></div>`;
  }).join('') + (list.length > S.lLimit ? `<button class="btn block" id="more">Xem thêm (${nf(list.length - S.lLimit)} đơn)</button>` : '');
  const more = $('#more'); if (more) more.onclick = () => { S.lLimit += 200; drawRows(); };
  $$('[data-a]', el).forEach(b => b.onclick = () => rowAction(b));
}
async function rowAction(b) {
  const code = b.dataset.c, a = b.dataset.a;
  const r = (S.returns || []).find(x => x.code === code); if (!r) return;
  if (a === 'unscan') {
    if (!b.dataset.armed) { twoStep(b, 'Bấm lần nữa', () => {}); return; }
    delete b.dataset.armed; b.disabled = true;
    const { error } = await sb.rpc('unscan', { p_shop: S.shop.id, p_code: code });
    if (error) { b.disabled = false; toast(errText(error)); return; }
    if (r.listed) { r.scanned_at = null; r.scanned_by_name = null; } else S.returns = S.returns.filter(x => x !== r);
    toast('Đã hủy quét ' + code);
  } else {
    b.disabled = true;
    const on = a === 'kn';
    const { error } = await sb.rpc('set_complaint', { p_shop: S.shop.id, p_code: code, p_on: on });
    if (error) { b.disabled = false; toast(errText(error)); return; }
    r.complaint_at = on ? new Date().toISOString() : null;
    toast(on ? 'Đã đánh dấu khiếu nại' : 'Đã bỏ khiếu nại');
  }
  S.returnsAt = Date.now();
  viewList();
}
async function exportList() {
  const list = filtered();
  if (!list.length) { toast('Không có đơn nào để xuất.'); return; }
  try { await loadScript(LIB.xlsx); } catch (e) { toast(e.message); return; }
  const aoa = [['Mã vận đơn', 'Mã đơn hàng', 'Sản phẩm', 'Khách hàng', 'Đơn vị vận chuyển', 'Ngày hoàn', 'Số ngày chưa về', 'Trạng thái', 'Thời gian về kho', 'Người quét', 'Khiếu nại từ']];
  for (const r of list) aoa.push([r.code, r.order_no || '', r.product || '', r.customer || '', r.carrier || '', r.return_date ? fmtDate(r.return_date) : '', r.scanned_at ? '' : ageDays(r), ST[rstatus(r)][0], r.scanned_at ? fmtDT(r.scanned_at) : '', r.scanned_by_name || '', r.complaint_at ? fmtDate(r.complaint_at) : '']);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [22, 18, 30, 20, 16, 12, 10, 14, 16, 14, 12].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Don hoan');
  const f = (FILTERS.find(x => x[0] === S.lf) || ['', 'Tat ca'])[1];
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  await saveBlob(`Don hoan - ${f} - ${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

// ---------- nhập file ------------------------------------------------------------
const FIELDS = [['code', 'Mã vận đơn', true], ['order_no', 'Mã đơn hàng'], ['product', 'Sản phẩm'], ['customer', 'Khách hàng'], ['carrier', 'Đơn vị vận chuyển'], ['return_date', 'Ngày']];
function guessCol(h) {
  const f = fold(h).trim(); if (!f) return null;
  if (/van don|tracking|waybill|ma vd|mvd|awb|ma van chuyen|so van don|ma giao hang/.test(f)) return 'code';
  if (/ma don|order|don hang|ma dh|so don/.test(f)) return 'order_no';
  if (/san pham|product|ten hang|hang hoa|sku|item/.test(f)) return 'product';
  if (/khach|nguoi nhan|recipient|buyer|nguoi mua|receiver/.test(f)) return 'customer';
  if (/van chuyen|carrier|dvvc|shipping|nha van|logistics/.test(f)) return 'carrier';
  if (/ngay|date|thoi gian|time/.test(f)) return 'return_date';
  return null;
}
function cellStr(v) {
  if (v instanceof Date) return isNaN(v) ? '' : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v == null ? '' : v).trim();
}
function toISODate(v) {
  if (v instanceof Date) return cellStr(v);
  const s = String(v == null ? '' : v).trim();
  let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  return '';
}

function viewImport() {
  const I = S.imp;
  shell(topbar('Nhập file'), `<main class="content" id="imp">
    ${!active() ? '<div class="err">Gói đã hết hạn nên chưa nhập được. Chủ shop cần gia hạn.</div>' : ''}
    <div class="seg" role="group" aria-label="Cách nhập"><button data-m="file" aria-pressed="${I.mode === 'file'}">Từ file Excel</button><button data-m="paste" aria-pressed="${I.mode === 'paste'}">Dán mã</button></div>
    <div id="impBody"></div>
    <div id="impSum"></div>
  </main>`);
  $$('[data-m]').forEach(b => b.onclick = () => { I.mode = b.dataset.m; viewImport(); });
  drawImport();
  loadReturns().then(() => drawSummary()).catch(() => {});
}
function drawImport() {
  const I = S.imp, el = $('#impBody'); if (!el) return;
  if (I.mode === 'paste') {
    el.innerHTML = `<label class="sr" for="paste">Danh sách mã</label><textarea class="input" id="paste" placeholder="Mỗi dòng một mã vận đơn, ví dụ:&#10;SPXVN041234567890&#10;GHN5KQ28X7">${esc(I.pasteText || '')}</textarea>`;
    let t; $('#paste').oninput = e => { clearTimeout(t); t = setTimeout(() => { I.pasteText = e.target.value; drawSummary(); }, 250); };
  } else if (!I.parsed) {
    el.innerHTML = `<label class="filebtn" for="file">${svg(ICON.import, 34)}<b>Chọn file danh sách đơn hoàn</b><span>.xlsx, .xls hoặc .csv · đơn cũ và mới đều được, mã trùng tự gộp</span></label><input type="file" id="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden>`;
    $('#file').onchange = e => { const f = e.target.files[0]; if (f) readFile(f); };
  } else {
    const P = I.parsed;
    const opts = ['<option value="">— Không dùng —</option>'].concat(P.headers.map((h, i) => `<option value="${i}">${esc(h)}</option>`)).join('');
    el.innerHTML = `<div class="card row" style="gap:12px"><span class="pill ok" style="font-family:var(--f-mono)">XLSX</span><div style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(P.name)}</b><span class="muted" style="font-size:13px">${nf(P.data.length)} dòng · trang “${esc(P.sheet)}”</span></div><button class="btn sm" id="chg">Đổi file</button></div>
      <div class="card map">${FIELDS.map(([k, l, req]) => `<label for="m_${k}"><span>${l}${req ? ' <b style="color:var(--bad)">*</b>' : ''}<br><small class="${I.map[k] != null ? '' : 'muted'}" style="font-size:12px;color:${I.map[k] != null ? 'var(--ok)' : ''}">${I.map[k] != null ? '✓ Đã chọn cột' : (req ? 'Chọn cột chứa mã vận đơn' : 'Không bắt buộc')}</small></span><select id="m_${k}" data-k="${k}">${opts}</select></label>`).join('')}</div>`;
    FIELDS.forEach(([k]) => { $('#m_' + k).value = I.map[k] != null ? String(I.map[k]) : ''; });
    $$('.map select').forEach(s => s.onchange = () => { I.map[s.dataset.k] = s.value === '' ? null : +s.value; drawImport(); drawSummary(); });
    $('#chg').onclick = () => { I.parsed = null; I.map = {}; drawImport(); drawSummary(); };
  }
  drawSummary();
}
async function readFile(f) {
  const el = $('#impBody'); el.innerHTML = '<div class="center"><div class="spin"></div><span class="muted">Đang đọc file…</span></div>';
  try {
    await loadScript(LIB.xlsx);
    const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string', cellDates: true }) : XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
    let best = null;
    for (const n of wb.SheetNames) { const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); if (!best || rows.length > best.rows.length) best = { n, rows }; }
    if (!best || !best.rows.length) throw new Error('File không có dữ liệu.');
    const rows = best.rows; let h = 0, score = -1;
    for (let i = 0; i < Math.min(15, rows.length); i++) { const s = rows[i].filter(v => typeof v === 'string' && guessCol(v)).length; if (s > score) { score = s; h = i; } }
    const width = Math.max(...rows.slice(h, h + 50).map(r => r.length));
    const headers = Array.from({ length: width }, (_, i) => cellStr(rows[h][i]) || ('Cột ' + XLSX.utils.encode_col(i)));
    const data = rows.slice(h + 1).filter(r => r.some(v => cellStr(v) !== ''));
    const map = {};
    headers.forEach((hd, i) => { const g = guessCol(hd); if (g && map[g] == null) map[g] = i; });
    if (map.code == null) {
      let bi = -1, bs = 0;
      for (let i = 0; i < width; i++) { let s = 0; for (const r of data.slice(0, 80)) { const v = norm(cellStr(r[i])); if (/^[A-Z0-9]{8,30}$/.test(v) && /\d/.test(v)) s++; } if (s > bs) { bs = s; bi = i; } }
      if (bi >= 0) map.code = bi;
    }
    S.imp.parsed = { name: f.name, sheet: best.n, headers, data }; S.imp.map = map;
  } catch (e) {
    S.imp.parsed = null; toast(e.message && /dữ liệu|thư viện/.test(e.message) ? e.message : 'Không đọc được file này. Lưu lại dưới dạng .xlsx hoặc .csv rồi thử lại.');
  }
  drawImport();
}
function buildRows() {
  const I = S.imp, out = new Map();
  if (I.mode === 'paste') {
    for (const line of String(I.pasteText || '').split(/[\n,;\t]+/)) { const c = norm(line); if (c.length >= 4 && c.length <= 40 && !out.has(c)) out.set(c, { code: c }); }
  } else if (I.parsed && I.map.code != null) {
    const M = I.map;
    for (const r of I.parsed.data) {
      const c = norm(cellStr(r[M.code])); if (c.length < 4 || c.length > 40 || out.has(c)) continue;
      const o = { code: c };
      for (const k of ['order_no', 'product', 'customer', 'carrier']) if (M[k] != null) { const v = cellStr(r[M[k]]); if (v) o[k] = v; }
      if (M.return_date != null) { const v = toISODate(r[M.return_date]); if (v) o.return_date = v; }
      out.set(c, o);
    }
  }
  return [...out.values()];
}
function drawSummary() {
  const el = $('#impSum'); if (!el) return;
  const rows = buildRows();
  if (!rows.length) { el.innerHTML = S.imp.parsed && S.imp.map.code == null ? '<div class="err">Chọn cột chứa mã vận đơn.</div>' : ''; return; }
  const have = new Set((S.returns || []).filter(r => r.listed).map(r => r.code));
  const fresh = S.returns ? rows.filter(r => !have.has(r.code)).length : null;
  el.innerHTML = `<div class="slab" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center">
      <div><b class="disp num" style="font-size:30px;display:block">${nf(rows.length)}</b><span class="muted" style="font-size:12px">mã trong file</span></div>
      <div><b class="disp num" style="font-size:30px;display:block;color:#FF9A66">${fresh == null ? '…' : nf(fresh)}</b><span class="muted" style="font-size:12px">mã mới</span></div>
      <div><b class="disp num" style="font-size:30px;display:block">${fresh == null ? '…' : nf(rows.length - fresh)}</b><span class="muted" style="font-size:12px">đã có, giữ trạng thái</span></div></div>
    <div id="impMsg"></div>
    <button class="btn primary big block" id="doImp" ${active() ? '' : 'disabled'}>Nhập ${nf(rows.length)} mã</button>`;
  $('#doImp').onclick = () => commitImport(rows);
}
async function commitImport(rows) {
  const b = $('#doImp'); b.disabled = true;
  let total = 0, fresh = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    b.textContent = `Đang nhập ${nf(Math.min(i + 1000, rows.length))}/${nf(rows.length)}…`;
    const { data, error } = await sb.rpc('import_returns', { p_shop: S.shop.id, p_rows: rows.slice(i, i + 1000) });
    if (error) { b.disabled = false; b.textContent = `Nhập ${nf(rows.length)} mã`; $('#impMsg').innerHTML = `<div class="err">${esc(errText(error))}${total ? ` Đã nhập được ${nf(total)} mã trước đó.` : ''}</div>`; S.returns = null; return; }
    total += data.total; fresh += data.new;
  }
  S.imp = { mode: S.imp.mode, parsed: null, map: {}, pasteText: '' };
  S.returns = null; S.lf = null;
  toast(`Đã nhập ${nf(total)} mã (${nf(fresh)} mã mới).`);
  go('list');
}

// ---------- nhân viên ---------------------------------------------------------------
async function viewStaff() {
  shell(topbar('Nhân viên'), loadingBody);
  const nowIso = new Date().toISOString();
  const [m, inv] = await Promise.all([
    sb.from('members').select('user_id,role,display_name,created_at').eq('shop_id', S.shop.id).order('created_at'),
    sb.from('invites').select('token,role,created_at,expires_at').eq('shop_id', S.shop.id).is('used_at', null).gt('expires_at', nowIso).order('created_at', { ascending: false })
  ]);
  if (route().page !== 'staff') return;
  const main = $('main.content');
  if (m.error) { main.innerHTML = `<div class="err">${esc(errText(m.error))}</div>`; return; }
  const members = m.data || [], invites = inv.data || [];
  const max = planOf(S.shop.plan).max_members;
  const linkOf = t => siteUrl() + '#/join/' + t;
  const roleSel = can('owner') ? `<div class="seg" role="group" aria-label="Vai trò" style="background:#1F2A35;border-color:#4A5866"><button data-r="staff" aria-pressed="${S.inviteRole === 'staff'}" style="color:${S.inviteRole === 'staff' ? '#fff' : '#C9D2DA'}">Nhân viên kho</button><button data-r="manager" aria-pressed="${S.inviteRole === 'manager'}" style="color:${S.inviteRole === 'manager' ? '#fff' : '#C9D2DA'}">Quản lý</button></div>` : '';
  main.innerHTML = `
    <div class="row" style="justify-content:space-between"><span class="muted">Tài khoản đang dùng</span><b class="num">${members.length}${max ? ' / ' + max : ''}</b></div>
    <div class="slab stack">
      <b style="font-size:16px">Mời người vào shop</b>
      <span class="muted" style="font-size:13px">${S.inviteRole === 'staff' ? 'Nhân viên kho chỉ quét được, không sửa hay xóa danh sách.' : 'Quản lý nhập file, khiếu nại, xuất Excel. Không thanh toán, không mời người.'} Mỗi link dùng cho 1 người, hết hạn sau 7 ngày.</span>
      ${roleSel}
      ${S.newInvite ? `<div class="linkbox"><span>${esc(linkOf(S.newInvite))}</span></div><div class="row"><button class="btn primary" id="share" style="flex:1;background:var(--glow);border-color:var(--glow);color:#1A0E07">Gửi qua Zalo / tin nhắn</button><button class="btn" id="copy" style="background:transparent;color:#E6EBEF;border-color:#4A5866">Chép</button></div>` : ''}
      ${S.newInvite && C.DEMO ? '<button class="btn" id="tryJoin" style="background:transparent;color:#E6EBEF;border-color:#4A5866">Thử mở link này như nhân viên mới</button>' : ''}
      <button class="btn ${S.newInvite ? '' : 'primary'}" id="mk" style="${S.newInvite ? 'background:transparent;color:#E6EBEF;border-color:#4A5866' : 'background:var(--glow);border-color:var(--glow);color:#1A0E07'}">${S.newInvite ? 'Tạo link cho người khác' : 'Tạo link mời'}</button>
      <div id="invMsg"></div>
    </div>
    <div class="card" style="padding:0 14px">${members.map(x => `<div class="member"><span class="av" style="${x.role === 'owner' ? 'background:var(--accent);color:#fff' : ''}">${esc((x.display_name || '?').charAt(0).toUpperCase())}</span>
      <div class="who"><b>${esc(x.display_name || 'Chưa đặt tên')}${S.user.id === x.user_id ? ' <span class="muted" style="font-weight:400">(bạn)</span>' : ''}</b><span class="muted" style="font-size:13px">${ROLE[x.role]} · từ ${fmtDate(x.created_at)}</span></div>
      ${x.role !== 'owner' && can('owner') ? `<button class="btn sm danger" data-rm="${x.user_id}">Xóa</button>` : ''}</div>`).join('')}</div>
    ${invites.length ? `<div class="stack" style="gap:6px"><span class="muted" style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Link mời chưa dùng</span>
      ${invites.map(i => `<div class="card row" style="padding:10px 14px"><div style="flex:1;min-width:0"><b>${ROLE[i.role]}</b><div class="muted" style="font-size:13px">Tạo ${fmtDT(i.created_at)} · hết hạn ${fmtDate(i.expires_at)}</div></div><button class="btn sm" data-sh="${i.token}">Gửi lại</button><button class="btn sm danger" data-rv="${i.token}">Thu hồi</button></div>`).join('')}</div>` : ''}`;
  $$('[data-r]').forEach(b => b.onclick = () => { S.inviteRole = b.dataset.r; S.newInvite = null; viewStaff(); });
  $('#mk').onclick = async e => {
    const b = e.currentTarget; busy(b, true, 'Đang tạo…');
    const { data, error } = await sb.rpc('create_invite', { p_shop: S.shop.id, p_role: S.inviteRole });
    if (error) { busy(b, false); $('#invMsg').innerHTML = `<div class="err">${esc(errText(error))}</div>`; return; }
    S.newInvite = data; viewStaff();
  };
  const tj = $('#tryJoin'); if (tj) tj.onclick = async () => { const t = S.newInvite; S.newInvite = null; await sb.auth.signOut(); await loadUser(null); go('join/' + t); };
  const sh = $('#share'); if (sh) sh.onclick = () => shareLink(linkOf(S.newInvite));
  const cp = $('#copy'); if (cp) cp.onclick = () => copyText(linkOf(S.newInvite));
  $$('[data-sh]').forEach(b => b.onclick = () => shareLink(linkOf(b.dataset.sh)));
  $$('[data-rv]').forEach(b => b.onclick = async () => { const { error } = await sb.from('invites').delete().eq('token', b.dataset.rv); if (error) toast(errText(error)); else { if (S.newInvite === b.dataset.rv) S.newInvite = null; toast('Đã thu hồi link'); viewStaff(); } });
  $$('[data-rm]').forEach(b => b.onclick = () => twoStep(b, 'Chắc chắn?', async () => {
    const { error } = await sb.from('members').delete().eq('shop_id', S.shop.id).eq('user_id', b.dataset.rm);
    if (error) toast(errText(error)); else { toast('Đã xóa khỏi shop'); viewStaff(); }
  }));
}
async function shareLink(url) {
  const text = `Mời bạn vào shop "${S.shop.name}" trên ${APP} để quét đơn hoàn. Mở link này bằng điện thoại:`;
  if (navigator.share) { try { await navigator.share({ title: APP, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copyText(url);
}

// ---------- gói & thanh toán -----------------------------------------------------
function qrUrl(p) {
  const B = C.BANK || {};
  if (!B.BANK_ID || !B.ACCOUNT_NO) return '';
  return `https://img.vietqr.io/image/${encodeURIComponent(B.BANK_ID)}-${encodeURIComponent(B.ACCOUNT_NO)}-compact2.png?amount=${p.amount}&addInfo=${encodeURIComponent(p.memo)}&accountName=${encodeURIComponent(B.ACCOUNT_NAME || '')}`;
}
async function viewBilling() {
  shell(topbar('Gói'), loadingBody);
  await refreshShop();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [pays, cnt, mem] = await Promise.all([
    sb.from('payments').select('*').eq('shop_id', S.shop.id).order('created_at', { ascending: false }).limit(12),
    sb.from('returns').select('code', { count: 'exact', head: true }).eq('shop_id', S.shop.id).eq('listed', true).gte('imported_at', monthStart.toISOString()),
    sb.from('members').select('user_id', { count: 'exact', head: true }).eq('shop_id', S.shop.id)
  ]);
  if (route().page !== 'billing') return;
  const main = $('main.content');
  if (pays.error) { main.innerHTML = `<div class="err">${esc(errText(pays.error))}</div>`; return; }
  const cur = planOf(S.shop.plan), act = active(), dl = daysLeft();
  const pendingRow = (pays.data || []).find(p => p.status === 'pending');
  const pending = S.repick ? null : pendingRow;
  const year = S.bc === 'y';
  const sellable = S.plans.filter(p => p.id !== 'trial');
  const priceOf = p => year ? p.price_year : p.price_month;
  const picks = sellable.map(p => {
    const pr = priceOf(p);
    const lim = [p.max_members ? `${p.max_members} tài khoản` : 'Không giới hạn tài khoản', p.max_returns_month ? `${nf(p.max_returns_month)} đơn/tháng` : 'không giới hạn đơn'].join(' · ');
    return `<button class="pick" data-p="${p.id}" aria-pressed="${S.bp === p.id}"><span class="l1"><b>${esc(p.name)}</b><b>${pr > 0 ? vnd(pr) : 'Liên hệ'}</b></span><small>${esc(lim)}${year && p.price_month > 0 && p.price_year > 0 ? ` · tương đương ${vnd(Math.round(p.price_year / 12))}/tháng` : ''}</small></button>`;
  }).join('');
  const sel = sellable.find(p => p.id === S.bp) || sellable[0];
  const selPrice = sel ? priceOf(sel) : 0;
  const qr = pending ? qrUrl(pending) : '';
  const B = C.BANK || {};
  main.innerHTML = `
    <div class="card" style="background:${act ? (dl <= 5 ? 'var(--warn-bg)' : 'var(--panel)') : 'var(--bad-bg)'}">
      <b>${esc(planName(S.shop.plan))} · ${act ? `còn ${dl} ngày` : 'đã hết hạn'}</b>
      <div class="muted" style="font-size:13px">${act ? 'Hết hạn' : 'Hết hạn từ'} ${fmtDate(S.shop.paid_until)} · ${mem.count || 0}${cur.max_members ? '/' + cur.max_members : ''} tài khoản · ${nf(cnt.count || 0)}${cur.max_returns_month ? '/' + nf(cur.max_returns_month) : ''} đơn nhập tháng này</div>
    </div>
    ${pending ? `
      <div class="card stack">
        <b>Chuyển khoản để kích hoạt ${esc(planName(pending.plan))} · ${pending.months === 12 ? '12 tháng' : '1 tháng'}</b>
        <div class="qr">${C.DEMO ? '<div class="ph">Mã QR VietQR hiện ở bản thật, quét bằng app ngân hàng là điền sẵn số tiền và nội dung</div>' : qr ? `<img src="${esc(qr)}" alt="Mã QR chuyển khoản ${esc(vnd(pending.amount))}">` : '<div class="ph">Chủ web chưa điền tài khoản ngân hàng trong config.js</div>'}
          <dl class="kv"><dt>Ngân hàng</dt><dd>${esc(B.BANK_ID || '—')}</dd><dt>Số TK</dt><dd class="mono">${esc(B.ACCOUNT_NO || '—')}</dd><dt>Chủ TK</dt><dd>${esc(B.ACCOUNT_NAME || '—')}</dd><dt>Số tiền</dt><dd>${vnd(pending.amount)}</dd><dt>Nội dung</dt><dd class="mono" style="color:var(--accent-ink)">${esc(pending.memo)}</dd></dl></div>
        <div class="row"><button class="btn sm" id="cpAcc" style="flex:1">Chép số TK</button><button class="btn sm" id="cpMemo" style="flex:1">Chép nội dung</button>${qr && !C.DEMO ? `<a class="btn sm" href="${esc(qr)}" target="_blank" rel="noopener" style="flex:1">Mở ảnh QR</a>` : ''}</div>
        <div class="note">Ghi <b>đúng nội dung chuyển khoản</b> để nhận ra shop của bạn. Gói được kích hoạt khi xác nhận tiền về, trang này tự cập nhật.</div>
        <div class="row" style="color:var(--warn);font-weight:600;font-size:14px"><span class="dot"></span>Đang chờ xác nhận…</div>
        <button class="btn ghost sm" id="newPay">Chọn gói khác</button>
      </div>` : `
      <div class="seg" role="group" aria-label="Chu kỳ"><button data-c="m" aria-pressed="${!year}">Theo tháng</button><button data-c="y" aria-pressed="${year}">Theo năm</button></div>
      ${picks}
      ${pendingRow ? '<div class="note">Mã chuyển khoản cũ sẽ bị hủy khi bạn tạo mã mới. Nếu đã chuyển tiền theo mã cũ, đừng tạo mã mới mà báo hỗ trợ.</div>' : ''}
      <div id="payMsg"></div>
      ${selPrice > 0 ? `<button class="btn primary big block" id="mkPay">Thanh toán ${vnd(selPrice)}</button>` : `<div class="note">Gói này chưa mở bán trên web.${C.SUPPORT_ZALO ? ` Liên hệ Zalo <b>${esc(C.SUPPORT_ZALO)}</b> để đăng ký.` : ''}</div>`}`}
    ${(pays.data || []).length ? `<div class="stack" style="gap:6px"><span class="muted" style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Lịch sử</span>
      ${(pays.data || []).map(p => `<div class="card row" style="padding:10px 14px"><div style="flex:1;min-width:0"><b>${esc(planName(p.plan))} · ${p.months} tháng</b><div class="muted" style="font-size:13px">${fmtDate(p.created_at)} · ${vnd(p.amount)}</div></div><span class="pill ${p.status === 'confirmed' ? 'ok' : p.status === 'pending' ? 'warn' : 'gray'}">${{ confirmed: 'Đã nhận', pending: 'Chờ', cancelled: 'Đã hủy' }[p.status]}</span></div>`).join('')}</div>` : ''}`;
  $$('[data-c]').forEach(b => b.onclick = () => { S.bc = b.dataset.c; viewBilling(); });
  $$('[data-p]').forEach(b => b.onclick = () => { S.bp = b.dataset.p; viewBilling(); });
  const mk = $('#mkPay'); if (mk) mk.onclick = async () => {
    busy(mk, true, 'Đang tạo mã…');
    const { error } = await sb.rpc('create_payment', { p_shop: S.shop.id, p_plan: sel.id, p_months: year ? 12 : 1 });
    if (error) { busy(mk, false); $('#payMsg').innerHTML = `<div class="err">${esc(errText(error))}</div>`; return; }
    S.repick = false; viewBilling();
  };
  const ca = $('#cpAcc'); if (ca) ca.onclick = () => copyText(B.ACCOUNT_NO || '');
  const cm = $('#cpMemo'); if (cm) cm.onclick = () => copyText(pending.memo);
  const np = $('#newPay'); if (np) np.onclick = () => { S.repick = true; S.bp = pending.plan; S.bc = pending.months === 12 ? 'y' : 'm'; viewBilling(); };
  if (pending) {
    const before = S.shop.paid_until;
    S.poll = setInterval(async () => {
      if (route().page !== 'billing') { clearInterval(S.poll); return; }
      const { data } = await sb.from('payments').select('status').eq('id', pending.id).maybeSingle();
      if (data && data.status !== 'pending') {
        clearInterval(S.poll); await refreshShop();
        if (data.status === 'confirmed') { feedback('ok'); toast(`Đã kích hoạt ${planName(S.shop.plan)} đến ${fmtDate(S.shop.paid_until)}.`); }
        if (S.shop.paid_until !== before || data.status) viewBilling();
      }
    }, 12000);
  }
}

// ---------- quản trị ------------------------------------------------------------------
async function viewAdmin() {
  app.innerHTML = `<div class="page"><header class="top" style="background:var(--night);color:var(--nightink);border-color:var(--night)">${S.members.length ? `<a class="iconbtn" href="#/scan" aria-label="Về app" style="color:inherit">${svg(ICON.back)}</a>` : ''}<h1 class="disp">Quản trị</h1><span class="pill" style="background:var(--bad);color:#fff;font-family:var(--f-mono)">CHỈ BẠN</span>${avatarBtn()}</header>${loadingBody}</div>`;
  $('#menuBtn').onclick = openMenu;
  const { data, error } = await sb.rpc('admin_overview');
  if (route().page !== 'admin') return;
  const main = $('main.content');
  if (error) { main.innerHTML = `<div class="err">${esc(errText(error))}</div>`; return; }
  const now = Date.now();
  const shops = data.shops || [], pend = data.pending || [];
  const isAct = s => Date.parse(s.paid_until) > now;
  const soon = s => isAct(s) && Date.parse(s.paid_until) - now < 7 * DAY;
  const k = { paid: shops.filter(s => s.plan !== 'trial' && isAct(s)).length, trial: shops.filter(s => s.plan === 'trial' && isAct(s)).length, soon: shops.filter(soon).length };
  const AF = [['all', 'Tất cả'], ['soon', 'Sắp hết hạn'], ['trial', 'Dùng thử'], ['paid', 'Trả phí'], ['exp', 'Hết hạn']];
  const fShop = s => S.af === 'all' || (S.af === 'soon' && soon(s)) || (S.af === 'trial' && s.plan === 'trial' && isAct(s)) || (S.af === 'paid' && s.plan !== 'trial' && isAct(s)) || (S.af === 'exp' && !isAct(s));
  const q = fold(S.aq).trim();
  const list = shops.filter(s => fShop(s) && (!q || fold([s.name, s.owner_name, s.owner_email, s.phone, s.code].join(' ')).includes(q)));
  main.innerHTML = `
    <div class="kpis">
      <div class="kpi"><b class="num" style="color:var(--ok)">${k.paid}</b><span>Shop trả phí</span></div>
      <div class="kpi"><b class="num">${k.trial}</b><span>Đang dùng thử</span></div>
      <div class="kpi"><b class="num" style="color:var(--bad)">${k.soon}</b><span>Hết hạn trong 7 ngày</span></div>
      <div class="kpi"><b class="num" style="font-size:24px">${vnd(data.revenue_month)}</b><span>Doanh thu tháng này</span></div>
    </div>
    ${pend.length ? `<div class="card stack" style="border:2px solid #F0A93B;gap:4px"><b>Chờ xác nhận chuyển khoản · ${pend.length}</b>
      ${pend.map(p => `<div class="stack" style="gap:6px;padding:10px 0;border-top:1px solid var(--line2)">
        <div class="row" style="justify-content:space-between"><b>${esc(p.shop_name)}</b><b>${vnd(p.amount)}</b></div>
        <span class="muted" style="font-size:13px">${esc(planName(p.plan))} · ${p.months} tháng · <span class="mono" style="color:var(--accent-ink);font-weight:700">${esc(p.memo)}</span> · ${fmtDT(p.created_at)}</span>
        <div class="row"><button class="btn ok" style="flex:1" data-ok="${p.id}">Đã nhận tiền · kích hoạt</button><button class="btn" data-no="${p.id}">Hủy</button></div></div>`).join('')}</div>` : ''}
    <label class="sr" for="aq">Tìm shop</label><input class="input" id="aq" type="search" placeholder="Tìm tên shop, email, SĐT, mã shop…" value="${esc(S.aq)}" style="min-height:44px">
    <div class="chips">${AF.map(([kk, l]) => `<button class="chip" data-af="${kk}" aria-pressed="${S.af === kk}">${l}</button>`).join('')}</div>
    <div class="card" style="padding:0 14px">${list.length ? list.map(s => `<div class="stack" style="gap:4px;padding:12px 0;border-bottom:1px solid var(--line2)">
        <div class="row" style="justify-content:space-between"><b>${esc(s.name)}</b><span class="pill ${!isAct(s) ? 'bad' : s.plan === 'pro' ? 'inv' : s.plan === 'basic' ? 'kn' : 'gray'}">${!isAct(s) ? 'Hết hạn' : esc(planName(s.plan))}</span></div>
        <span class="muted" style="font-size:13px">${esc(s.owner_name || '')} · ${esc(s.owner_email || '')}${s.phone ? ' · ' + esc(s.phone) : ''} · mã <span class="mono">${esc(s.code)}</span></span>
        <span class="muted" style="font-size:13px">${s.members} TK · ${nf(s.returns_month)} đơn tháng này · quét gần nhất ${s.last_scan ? fmtDT(s.last_scan) : '—'}</span>
        <div class="row" style="justify-content:space-between"><span style="font-size:13px;font-weight:600;color:${soon(s) || !isAct(s) ? 'var(--bad)' : 'var(--ink2)'}">Hết hạn ${fmtDate(s.paid_until)}</span>
          <span class="row" style="gap:6px"><label class="sr" for="pl_${s.id}">Gói</label><select id="pl_${s.id}" data-pl="${s.id}" style="min-height:36px;border:1px solid var(--field);border-radius:8px;background:var(--panel);font-size:13px">${S.plans.map(p => `<option value="${p.id}" ${p.id === s.plan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><button class="btn sm" data-ext="${s.id}">+30 ngày</button></span></div>
      </div>`).join('') : '<div class="muted" style="padding:14px 0">Không có shop nào.</div>'}</div>`;
  $$('[data-ok]').forEach(b => b.onclick = () => twoStep(b, 'Bấm lần nữa để kích hoạt', async () => {
    b.disabled = true; const { error: e } = await sb.rpc('admin_confirm_payment', { p_id: +b.dataset.ok });
    if (e) { b.disabled = false; toast(errText(e)); return; } toast('Đã kích hoạt gói.'); viewAdmin();
  }));
  $$('[data-no]').forEach(b => b.onclick = () => twoStep(b, 'Chắc chắn?', async () => { const { error: e } = await sb.rpc('admin_cancel_payment', { p_id: +b.dataset.no }); if (e) toast(errText(e)); else viewAdmin(); }));
  $$('[data-ext]').forEach(b => b.onclick = () => twoStep(b, 'Thêm 30 ngày?', async () => { const { error: e } = await sb.rpc('admin_extend', { p_shop: b.dataset.ext, p_days: 30 }); if (e) toast(errText(e)); else { toast('Đã cộng 30 ngày.'); viewAdmin(); } }));
  $$('[data-pl]').forEach(s => s.onchange = async () => { const { error: e } = await sb.rpc('admin_set_plan', { p_shop: s.dataset.pl, p_plan: s.value }); if (e) toast(errText(e)); else { toast('Đã đổi gói.'); viewAdmin(); } });
  $$('[data-af]').forEach(b => b.onclick = () => { S.af = b.dataset.af; viewAdmin(); });
  let t; $('#aq').oninput = e => { clearTimeout(t); t = setTimeout(() => { S.aq = e.target.value; viewAdmin().then(() => { const i = $('#aq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); };
}

boot();
})();
