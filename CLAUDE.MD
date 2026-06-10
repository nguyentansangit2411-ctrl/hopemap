# HopeMap — Project Context

## Dự án là gì
Web app crowdsourcing bản đồ từ thiện. Người đi đường báo cáo
hoàn cảnh khó khăn (vô gia cư, cụ già bệnh...) → xác minh
→ hiển thị bản đồ → nhà hảo tâm đến giúp.

## Tech Stack
- Framework: Next.js 14 App Router + TypeScript
- Database: Supabase (PostgreSQL + PostGIS)
- Auth: Clerk
- Storage: Cloudinary (ảnh tự nén)
- Map: Leaflet.js + OpenStreetMap
- Hosting: Vercel
- Style: Tailwind CSS

## Nguyên tắc code
- Mobile-first LUÔN LUÔN — đây là app dùng trên điện thoại
- Tối giản UI — người dùng đang đứng trên đường
- Mọi form phải hoàn thành được trong < 60 giây
- Blur mặt người trong ảnh trước khi upload (face-api.js)
- Strip EXIF metadata khỏi ảnh trước khi lưu
- Không dùng `any` trong TypeScript
- CẢNH BÁO: Leaflet có vấn đề với SSR trong Next.js. BẮT BUỘC dùng dynamic import với `ssr: false` cho mọi component chứa Leaflet.

## Cấu trúc thư mục chuẩn
src/
  app/          → pages (App Router)
  components/   → UI components
  lib/          → utilities, db queries
  types/        → TypeScript interfaces

## Database tables chính
- reports (bài báo cáo hoàn cảnh)
- verifications (xác minh từ cộng đồng)
- users (profile mở rộng từ Clerk)

## Trạng thái bài viết (status flow)
pending → community_verified → field_verified → helped → closed

## KHÔNG làm trong MVP
- Mobile app native
- Tính năng donate/chuyển khoản
- Gamification phức tạp
- Mở rộng ngoài TP.HCM