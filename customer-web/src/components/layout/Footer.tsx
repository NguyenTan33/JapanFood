import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  ExternalLink, 
  Award, 
  ShieldCheck 
} from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative bg-sumi-900 border-t border-kin-500/20 text-washi-200 overflow-hidden">
      {/* Decorative Top Seigaiha Line */}
      <div className="w-full h-1.5 japanese-pattern-seigaiha border-b border-kin-500/20" />

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          
          {/* Column 1: Restaurant Story & Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 shrink-0 rounded-full border border-kin-500/50 flex items-center justify-center bg-sumi-950">
                <span className="font-kanji text-kin-400 text-xl font-bold">桜</span>
              </div>
              <div className="min-w-0">
                <span className="font-serif text-2xl font-bold tracking-wider text-washi-100">
                  SAKURA
                </span>
                <p className="text-[9px] tracking-[0.25em] text-kin-500/90 uppercase font-medium">
                  Japanese Fine Dining
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-washi-300">
              Tinh hoa ẩm thực Nhật Bản giữa lòng Sài Gòn. Từng thớ cá ngừ vây xanh, nhum biển Hokkaido và bò Wagyu A5 được tuyển chọn trực tiếp từ chợ cá Toyosu danh tiếng, mang đến trải nghiệm mỹ vị nguyên bản.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Theo dõi Facebook"
                className="w-8 h-8 shrink-0 rounded-full border border-kin-500/30 flex items-center justify-center text-washi-200 hover:text-kin-400 hover:border-kin-400 bg-sumi-950 transition-all"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Theo dõi Instagram"
                className="w-8 h-8 shrink-0 rounded-full border border-kin-500/30 flex items-center justify-center text-washi-200 hover:text-kin-400 hover:border-kin-400 bg-sumi-950 transition-all"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
              <div className="px-2.5 py-1 rounded-full border border-kin-500/20 bg-sumi-950/80 text-[10px] text-kin-400 font-medium flex items-center space-x-1 whitespace-nowrap">
                <Award className="w-3 h-3 text-kin-400 shrink-0" />
                <span>Michelin Selected 2025</span>
              </div>
            </div>
          </div>

          {/* Column 2: Opening Hours & Contact */}
          <div className="space-y-4">
            <h3 className="font-serif text-base font-semibold text-washi-100 tracking-wider flex items-center space-x-2 border-b border-kin-500/20 pb-2">
              <Clock className="w-4 h-4 text-kin-400" />
              <span>Giờ Phục Vụ & Hotline</span>
            </h3>

            <div className="space-y-2.5 text-xs text-washi-300">
              <div className="flex justify-between pb-1 border-b border-sumi-800">
                <span className="text-washi-100 font-medium">Bữa trưa:</span>
                <span className="text-kin-300 font-semibold">10:30 – 14:00</span>
              </div>
              <div className="flex justify-between pb-1 border-b border-sumi-800">
                <span className="text-washi-100 font-medium">Bữa tối:</span>
                <span className="text-kin-300 font-semibold">17:00 – 22:30</span>
              </div>
              <p className="text-[11px] text-kin-400 italic">
                * Mở cửa phục vụ tất cả các ngày trong tuần (kể cả Lễ, Tết).
              </p>
            </div>

            <div className="pt-2 space-y-2 text-xs">
              <a 
                href="tel:19008899"
                className="flex items-center space-x-2 text-washi-100 hover:text-kin-400 font-semibold transition-colors"
              >
                <Phone className="w-4 h-4 text-shu-500 shrink-0" />
                <span>Hotline: 1900 8899 / 0903 123 456</span>
              </a>
              <a 
                href="mailto:contact@torisakura.vn"
                className="flex items-center space-x-2 text-washi-300 hover:text-kin-400 transition-colors min-w-0"
              >
                <Mail className="w-4 h-4 text-kin-400 shrink-0" />
                <span className="min-w-0 break-all">contact@torisakura.vn</span>
              </a>
            </div>
          </div>

          {/* Column 3: Branch Locations */}
          <div className="space-y-4">
            <h3 className="font-serif text-base font-semibold text-washi-100 tracking-wider flex items-center space-x-2 border-b border-kin-500/20 pb-2">
              <MapPin className="w-4 h-4 text-kin-400" />
              <span>Hệ Thống Chi Nhánh</span>
            </h3>

            <div className="space-y-3 text-xs text-washi-300">
              <div>
                <p className="font-semibold text-washi-100">Chi nhánh 1 (Flagship Quận 1):</p>
                <p className="text-washi-300">15A/2 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. HCM</p>
              </div>
              <div>
                <p className="font-semibold text-washi-100">Chi nhánh 2 (Thảo Điền):</p>
                <p className="text-washi-300">68 Xuân Thủy, P. Thảo Điền, TP. Thủ Đức, TP. HCM</p>
              </div>
              <div>
                <p className="font-semibold text-washi-100">Chi nhánh 3 (Hà Nội):</p>
                <p className="text-washi-300">36 Kim Mã, Ba Đình, Hà Nội</p>
              </div>

              <Link
                to="/location"
                className="inline-flex items-center space-x-1.5 text-xs text-kin-400 hover:text-kin-300 font-medium pt-1 group"
              >
                <span>Xem bản đồ Google Maps & Hướng dẫn đỗ xe</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Column 4: Quick Links & Policies */}
          <div className="space-y-4">
            <h3 className="font-serif text-base font-semibold text-washi-100 tracking-wider flex items-center space-x-2 border-b border-kin-500/20 pb-2">
              <ShieldCheck className="w-4 h-4 text-kin-400" />
              <span>Chính Sách & Khám Phá</span>
            </h3>

            <ul className="space-y-2 text-xs text-washi-300">
              <li>
                <Link to="/menu" className="hover:text-kin-400 transition-colors">
                  Thực đơn 3D Omakase & A La Carte
                </Link>
              </li>
              <li>
                <Link to="/reservation" className="hover:text-kin-400 transition-colors">
                  Quy định đặt bàn & Chọn phòng riêng Tatami
                </Link>
              </li>
              <li>
                <Link to="/checkout" className="hover:text-kin-400 transition-colors">
                  Chính sách đặt cọc 50% & Thanh toán COD
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-kin-400 transition-colors">
                  Văn hóa ẩm thực Nhật Bản & Cẩm nang Sashimi
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-kin-400 transition-colors">
                  Triết lý Omotenashi & Nguồn gốc nguyên liệu
                </Link>
              </li>
            </ul>

            <div className="pt-2 flex items-center space-x-2 text-[11px] text-sumi-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Chứng nhận ATTP số 248/2024/ATTP-HCM</span>
            </div>
          </div>

        </div>

        {/* Bottom Copyright Bar */}
        <div className="mt-12 pt-6 border-t border-kin-500/10 flex flex-col sm:flex-row items-center justify-between text-xs text-sumi-300 gap-4">
          <div className="flex items-center space-x-2 text-center sm:text-left">
            <span>© 2026 SAKURA Japanese Fine Dining. All rights reserved.</span>
          </div>

          {/* Payment Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[10px] text-washi-400">
            <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800 font-mono">VietQR</span>
            <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800 font-mono">VNPAY</span>
            <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800 font-mono">MoMo</span>
            <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800 font-mono">Visa / Master</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
