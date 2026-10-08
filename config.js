// =====================================================================
//  CÀI ĐẶT — chỉ cần sửa file này. Xem HUONG-DAN.md, bước 3.
// =====================================================================
window.APP_CONFIG = {
  // Lấy ở Supabase → Project Settings → API (hoặc nút "Connect")
  SUPABASE_URL: 'https://kluipmevtqrypebmnigj.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_yb6fh_OP0yj6B0mglq5OcA_P718N0vb',

  APP_NAME: 'Rà Soát Đơn Hoàn',
  SUPPORT_ZALO: '',            // ví dụ '0901234567' — hiện ở chân trang và trang Gói
  COMPANY: '',                 // tên doanh nghiệp / hộ kinh doanh, hiện ở chân trang

  // Tài khoản nhận tiền. BANK_ID là mã ngân hàng theo VietQR, ví dụ: VCB, TCB, MB, ACB, VPB, BIDV, ICB (VietinBank), TPB
  BANK: {
    BANK_ID: '',
    ACCOUNT_NO: '',
    ACCOUNT_NAME: ''           // viết hoa không dấu, ví dụ 'NGUYEN VAN CUONG'
  }
};
