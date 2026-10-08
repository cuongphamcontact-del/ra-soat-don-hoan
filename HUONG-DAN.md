# Hướng dẫn đưa web Rà Soát Đơn Hoàn lên mạng

Bạn cần 2 tài khoản miễn phí:

- **Supabase** để lưu dữ liệu và quản lý đăng nhập.
- **Netlify** để đưa web lên mạng.

Tổng thời gian khoảng 30 phút. Không cần biết lập trình, chỉ cần làm đúng thứ tự.

## Trong thư mục có gì

| File | Dùng để |
|---|---|
| `config.js` | **File duy nhất bạn cần sửa**: khóa Supabase, tài khoản ngân hàng, số Zalo hỗ trợ |
| `schema.sql` | Tạo cơ sở dữ liệu. Dán vào Supabase một lần |
| `index.html`, `app.js`, `style.css`, `vendor/` | Web. Không cần sửa |
| `manifest.json`, `icon-*.png` | Cho phép "Thêm vào màn hình chính" như một app |

---

## Bước 1: Tạo cơ sở dữ liệu trên Supabase

1. Vào **supabase.com** → **Start your project** → đăng nhập bằng GitHub hoặc email.
2. Bấm **New project** rồi điền:
   - **Name:** `ra-soat-don-hoan`
   - **Database Password:** bấm *Generate*, rồi **lưu mật khẩu này lại**.
   - **Region:** chọn **Southeast Asia (Singapore)** để web chạy nhanh ở Việt Nam.
3. Bấm **Create new project**, đợi 1–2 phút.

## Bước 2: Chạy file schema.sql

1. Ở menu trái, chọn **SQL Editor** → **New query**.
2. Mở file `schema.sql` bằng Notepad (hoặc TextEdit trên Mac). Chọn tất cả (Ctrl+A), chép, rồi dán vào ô soạn thảo.
3. Bấm **Run**. Dòng **Success. No rows returned** hiện ra là đúng.

> Sau này nếu có bản `schema.sql` mới, cứ dán và Run lại. Dữ liệu cũ không mất.

## Bước 3: Cài đặt đăng nhập

Vào **Authentication** → **Sign In / Providers** (có bản ghi là **Providers**):

1. Bật **Allow anonymous sign-ins**. Đây là cách nhân viên kho vào bằng link mời mà không cần email. Không bật thì nhân viên báo lỗi khi mở link mời.
2. Mục **Email**: nên **tắt "Confirm email"** lúc mới chạy. Hộp thư mặc định của Supabase chỉ gửi được **2 email mỗi giờ**, khách đăng ký dễ bị kẹt chờ email xác nhận. Khi bán nhiều, xem Bước 9 để bật lại.
3. Bấm **Save**.

## Bước 4: Điền khóa vào config.js

1. Ở Supabase, bấm nút **Connect** trên cùng, hoặc vào **Project Settings** → **API Keys**.
2. Chép 2 giá trị:
   - **Project URL**, có dạng `https://abcdxyz.supabase.co`
   - Khóa **anon public** hoặc **publishable**. Khóa này dài, bắt đầu bằng `eyJ...` hoặc `sb_publishable_...`.
   - ⚠️ **Không dùng** khóa `service_role` hay `secret`. Khóa đó có toàn quyền, lộ ra là mất dữ liệu.
3. Mở `config.js` bằng Notepad và điền:

```js
SUPABASE_URL: 'https://abcdxyz.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...',
SUPPORT_ZALO: '0901234567',
COMPANY: 'Hộ kinh doanh ...',
BANK: {
  BANK_ID: 'VCB',             // mã ngân hàng: VCB, TCB, MB, ACB, VPB, BIDV, ICB (VietinBank), TPB...
  ACCOUNT_NO: '0123456789',
  ACCOUNT_NAME: 'NGUYEN VAN CUONG'
}
```

4. Lưu file. Giữ nguyên các dấu `'` và `,`.

## Bước 5: Đưa web lên mạng bằng Netlify

1. Vào **app.netlify.com/drop** và đăng ký miễn phí (bằng email hoặc GitHub).
2. **Kéo cả thư mục** `rsdh-app` (thư mục chứa `index.html`) thả vào ô trên trang.
3. Khoảng 10 giây sau, bạn có địa chỉ dạng `https://ten-ngau-nhien.netlify.app`.
4. Đổi tên cho dễ nhớ: **Site configuration** → **Change site name**, ví dụ `rasoatdonhoan` → `https://rasoatdonhoan.netlify.app`.

> Web phải chạy bằng **https** thì điện thoại mới cho mở camera. Netlify có sẵn https.

## Bước 6: Báo cho Supabase biết địa chỉ web

Vào **Authentication** → **URL Configuration**:

- **Site URL:** dán địa chỉ Netlify, ví dụ `https://rasoatdonhoan.netlify.app`
- **Redirect URLs:** bấm **Add URL**, thêm `https://rasoatdonhoan.netlify.app/**`

Bấm **Save**. Thiếu bước này thì link "Quên mật khẩu" và link xác nhận email sẽ mở sai trang.

## Bước 7: Tự cấp quyền quản trị cho bạn

1. Mở web, bấm **Dùng thử**, đăng ký tài khoản của chính bạn.
2. Vào Supabase → **SQL Editor** → **New query**, dán đoạn sau (thay email của bạn) rồi **Run**:

```sql
insert into admins (user_id)
select id from auth.users where email = 'email-cua-ban@gmail.com';
```

3. Tải lại web, bấm vào chữ cái đầu tên bạn ở góc phải, menu sẽ có **Trang quản trị**.

## Bước 8: Đặt giá và giới hạn gói

Vào Supabase → **Table Editor** → bảng **plans**. Bấm đúp vào ô để sửa:

| Cột | Ý nghĩa |
|---|---|
| `price_month` | Giá 1 tháng (đồng). Ví dụ `199000`. Để `0` thì gói hiện chữ "Liên hệ", khách không tự thanh toán được |
| `price_year` | Giá 12 tháng (đồng) |
| `max_members` | Số tài khoản tối đa mỗi shop. Để trống là không giới hạn |
| `max_returns_month` | Số đơn hoàn nhập mới tối đa mỗi tháng. Để trống là không giới hạn |

Có 3 gói: `trial` (dùng thử 14 ngày), `basic` (Cơ bản) và `pro` (Chuyên nghiệp). Muốn đổi số ngày dùng thử, nhắn mình sửa giúp.

---

## Mỗi ngày vận hành thế nào

**Khách mới đăng ký:** khách tự đăng ký, có ngay 14 ngày dùng thử. Bạn không phải làm gì.

**Khách trả tiền:**
1. Khách vào tab **Gói**, chọn gói. Web hiện mã QR, số tiền và nội dung chuyển khoản dạng `RSDH ABC123 CB01`. Trong đó `ABC123` là mã shop, `CB01` là gói Cơ bản 1 tháng.
2. Bạn thấy tiền về tài khoản thì mở **Trang quản trị** → **Đã nhận tiền · kích hoạt**. Bấm 2 lần để chắc chắn.
3. Gói được gia hạn ngay, trang của khách tự cập nhật.

**Tặng thêm ngày hoặc đổi gói tay:** trên **Trang quản trị**, bấm **+30 ngày** hoặc chọn gói khác cho shop đó.

**Shop hết hạn:** không quét và không nhập mới được nữa, nhưng vẫn xem và xuất Excel được. Dữ liệu không bị xóa.

**Cập nhật web:** khi có bản mới, vào Netlify → chọn site → **Deploys** → kéo thả thư mục mới vào. Nhớ dùng lại file `config.js` của bạn.

## Bước 9: Trước khi bán thật

- **Nâng gói Supabase Pro ($25/tháng).** Gói Free sẽ **tạm dừng web nếu 7 ngày không ai dùng** và giới hạn 500 MB dữ liệu. Có khách trả tiền rồi thì nên nâng gói để web không bao giờ bị dừng và được sao lưu hằng ngày.
- **Hộp thư gửi email riêng.** Thư mặc định của Supabase chỉ gửi 2 email mỗi giờ. Đăng ký một dịch vụ gửi mail như Resend hoặc Brevo (có gói miễn phí), rồi điền vào Supabase → **Authentication** → **Emails** → **SMTP Settings**. Sau đó có thể bật lại "Confirm email".
- **Tên miền riêng.** Mua tên miền (ví dụ `donhoan.vn`), gắn vào Netlify ở **Domain management**. Nhớ sửa lại địa chỉ ở Bước 6.
- **Chính sách bảo mật.** Web lưu tên khách hàng và mã đơn của shop. Nên có một trang ghi rõ bạn lưu gì và không chia sẻ cho ai.

## Lỗi thường gặp

| Hiện tượng | Cách sửa |
|---|---|
| Web báo "Chưa cài đặt xong" | `config.js` chưa điền đúng URL hoặc khóa (Bước 4) |
| Nhân viên mở link mời bị lỗi "chưa bật đăng nhập cho nhân viên" | Bật *Allow anonymous sign-ins* (Bước 3) |
| Camera không mở | Phải mở web bằng `https://`. Trên điện thoại, vào cài đặt trình duyệt, cho phép **Camera** với trang này |
| Đăng ký xong không nhận được email | Tắt *Confirm email* (Bước 3), hoặc cài hộp thư riêng (Bước 9) |
| Trang quản trị không hiện | Chạy lại câu lệnh ở Bước 7, kiểm tra email gõ đúng, rồi đăng xuất và đăng nhập lại |
| Web không vào được sau một thời gian | Project Supabase Free bị tạm dừng. Vào supabase.com, bấm **Restore project** (xem Bước 9) |
| Nhân viên đổi điện thoại hoặc xóa dữ liệu trình duyệt | Chủ shop tạo link mời mới, xóa tên cũ trong tab **Nhân viên** |
