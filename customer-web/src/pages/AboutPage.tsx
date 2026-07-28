import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  Award, 
  Heart, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  BookOpen, 
  Fish, 
  Flame, 
  Utensils,
  ShieldCheck,
  Compass,
  ArrowRight,
  Quote,
  Star,
  Play,
  Film,
  X
} from 'lucide-react';
import { restaurantInfoService, RestaurantInfoDto } from '@/services/restaurantInfoService';

export const AboutPage: React.FC = () => {
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfoDto | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [activeVideoTab, setActiveVideoTab] = useState<'craft' | 'ambience'>('craft');

  useEffect(() => {
    let isMounted = true;
    restaurantInfoService.getRestaurantInfo()
      .then(info => { if (isMounted) setRestaurantInfo(info); })
      .catch(err => console.error('Lỗi tải thông tin nhà hàng:', err));
    return () => { isMounted = false; };
  }, []);

  const videoData = {
    craft: {
      title: 'Nghệ Thuật Bếp Trưởng: Tinh Hoa Omakase & Kỹ Thuật Dao Ikijime',
      desc: 'Chiêm ngưỡng nghệ nhân ẩm thực chế biến từng thớ cá ngừ Otoro hun khói than Binchotan thượng hạng và triết lý ẩm thực Nhật Bản.',
      embedUrl: 'https://www.youtube.com/embed/A9eNzgDIYJg?autoplay=1&mute=0&rel=0',
      duration: '08 phút 24 giây',
      director: 'Eater Gourmet • Omakase Masterclass',
      poster: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1600&q=85',
    },
    ambience: {
      title: 'Không Gian & Kiến Trúc: Thanh Tịnh Cố Đô Kyoto & Mùa Hoa Sakura',
      desc: 'Hòa mình vào không gian cố đô Kyoto thanh tịnh, vườn thiền sỏi trắng, kiến trúc Machiya gỗ mộc và hoa anh đào Sakura.',
      embedUrl: 'https://www.youtube.com/embed/yqf4pUWzP4Q?autoplay=1&mute=0&rel=0',
      duration: '15 phút 10 giây',
      director: 'Rambalac 4K • Kyoto Zen Ambience',
      poster: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=85',
    },
  };

  const currentVideo = videoData[activeVideoTab];
  return (
    <div className="flex-1 flex flex-col py-8 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-16 sm:space-y-28">
      
      {/* 1. HERO SECTION: LỜI MỞ ĐẦU THƠ MỘNG */}
      <section className="text-center max-w-4xl mx-auto space-y-6 relative">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-sumi-900 border border-kin-500/40 text-xs font-semibold text-kin-400 shadow-gold-glow animate-fade-in">
          <span className="font-kanji">桜鳥の物語</span>
          <span>•</span>
          <span>Hành Trình 20 Năm Gìn Giữ Tinh Hoa Phù Tang</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-washi-100 leading-tight">
          Chắt Chiu Linh Hồn Cố Đô, <br />
          <span className="gold-text-gradient">Đánh Thức Vị Giác Giữa Lòng Sài Gòn</span>
        </h1>

        <p className="text-sm sm:text-base text-washi-300 leading-relaxed font-light max-w-3xl mx-auto">
          Khởi nguồn từ một đêm tuyết rơi trắng xóa nơi con ngõ nhỏ Gion (Kyoto), nơi ngọn đèn lồng giấy Akachochin đỏ thắm tỏa hơi ấm và mùi nước dùng Dashi ngào ngạt quyện vào không gian buốt giá. <strong>{restaurantInfo?.brandName || 'TORI SAKURA JAPANESE DINING'}</strong> được tượng hình từ lời thệ nguyện của những nghệ nhân ẩm thực: mang trọn vẹn sự thuần khiết, thanh tao và cầu toàn tột bậc của phong vị Kaiseki & Edomae nguyên bản về với thực khách Việt Nam.
        </p>

        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-kin-400 to-transparent mx-auto pt-2" />
      </section>

      {/* 2. THƯỚC PHIM TƯ LIỆU: KHÔNG GIAN & NGHỆ THUẬT ẨM THỰC SAKURA */}
      <section className="space-y-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center space-x-2 text-xs uppercase tracking-widest text-kin-400 font-semibold font-mono mb-1">
              <Film className="w-3.5 h-3.5" />
              <span>Thước Phim Tư Liệu • 映像アーカイブ</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100">
              Chiêm Ngưỡng Nghệ Thuật & Không Gian SAKURA
            </h2>
          </div>

          {/* Video Selector Tabs */}
          <div className="flex items-center space-x-2 bg-sumi-900/90 p-1 rounded-xl border border-kin-500/30">
            <button
              type="button"
              onClick={() => {
                setActiveVideoTab('craft');
                setIsVideoPlaying(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeVideoTab === 'craft'
                  ? 'bg-shu-700 text-white shadow-md'
                  : 'text-washi-400 hover:text-white'
              }`}
            >
              Nghệ Thuật Bếp Trưởng
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveVideoTab('ambience');
                setIsVideoPlaying(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeVideoTab === 'ambience'
                  ? 'bg-shu-700 text-white shadow-md'
                  : 'text-washi-400 hover:text-white'
              }`}
            >
              Không Gian & Kiến Trúc
            </button>
          </div>
        </div>

        {/* Cinematic Video Player Container */}
        <div className="relative rounded-3xl overflow-hidden border-2 border-kin-500/40 shadow-2xl bg-black aspect-[16/9] w-full group">
          {isVideoPlaying ? (
            <div className="relative w-full h-full bg-black">
              <iframe
                title={currentVideo.title}
                src={currentVideo.embedUrl}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
              <button
                type="button"
                onClick={() => setIsVideoPlaying(false)}
                aria-label="Đóng video"
                className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/80 hover:bg-shu-800 text-washi-300 hover:text-white border border-kin-500/40 transition-colors shadow-2xl"
                title="Đóng video trở về màn hình giới thiệu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <img
                src={currentVideo.poster}
                alt={currentVideo.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Dark Japanese lacquer gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-sumi-950 via-sumi-950/40 to-black/60" />

              {/* Top badge */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center space-x-2 bg-sumi-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-kin-500/50 text-xs font-semibold text-kin-300 shadow-xl">
                <span className="w-2 h-2 rounded-full bg-shu-500 animate-ping shrink-0" />
                <span>CHẤT LƯỢNG 4K ULTRA HD • PHỤ ĐỀ SONG NGỮ</span>
              </div>

              {/* Big Pulsing Center Play Button */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsVideoPlaying(true)}
                  aria-label="Phát video giới thiệu nhà hàng"
                  className="group/btn relative flex items-center justify-center mb-4 transition-transform hover:scale-110 active:scale-95"
                >
                  <span className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-shu-600/30 animate-ping pointer-events-none" />
                  <span className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-kin-500/20 animate-pulse pointer-events-none" />
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-shu-700 via-shu-600 to-shu-800 border-2 border-kin-400 shadow-2xl flex items-center justify-center text-white">
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-kin-300 text-kin-300 ml-1 drop-shadow" />
                  </div>
                </button>
                <h3 className="font-serif text-lg sm:text-2xl font-bold text-white drop-shadow-lg max-w-2xl px-4">
                  {currentVideo.title}
                </h3>
                <p className="text-xs sm:text-sm text-washi-300 max-w-xl mt-1.5 font-light drop-shadow px-4">
                  {currentVideo.desc}
                </p>
              </div>

              {/* Bottom information bar */}
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex items-center justify-between text-xs text-washi-400 bg-sumi-950/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-sumi-800">
                <div className="flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-kin-400" />
                  <span>Thời lượng: <strong>{currentVideo.duration}</strong></span>
                </div>
                <div className="flex items-center space-x-2 text-kin-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{currentVideo.director}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3 Pillars Below Video */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-sumi-900/60 border border-kin-500/20 flex items-start space-x-3">
            <Fish className="w-5 h-5 text-kin-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-washi-100">Kỹ Thuật Dao Ikijime</h4>
              <p className="text-[11px] text-washi-400 mt-0.5">Giữ trọn độ giòn ngọt và vị Umami tự nhiên của từng thớ cá Toyosu vận chuyển đường hàng không.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-sumi-900/60 border border-kin-500/20 flex items-start space-x-3">
            <Flame className="w-5 h-5 text-shu-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-washi-100">Than Trắng Binchotan</h4>
              <p className="text-[11px] text-washi-400 mt-0.5">Nướng bò Wagyu A5 Miyazaki ở nhiệt độ 1000°C không khói, khóa trọn vẹn vân mỡ cẩm thạch béo ngậy.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-sumi-900/60 border border-kin-500/20 flex items-start space-x-3">
            <Heart className="w-5 h-5 text-kin-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-washi-100">Triết Lý Omotenashi</h4>
              <p className="text-[11px] text-washi-400 mt-0.5">Phụng sự từ tâm khảm, thấu hiểu và nâng niu từng trải nghiệm ẩm thực nhỏ nhất của mỗi thực khách.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CHƯƠNG I: Ý NGHĨA BIỂU TƯỢNG TORI SAKURA (桜鳥) */}
      <section className="bg-gradient-to-br from-sumi-900 via-sumi-950 to-sumi-900 border border-kin-500/30 rounded-3xl p-6 sm:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-shu-700/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 space-y-4">
            <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold font-mono">
              Tâm Điểm Văn Hóa • 象徴の美学
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-washi-100 leading-snug">
              Ý Nghĩa Tên Gọi <br />
              <span className="text-shu-400">Tori Sakura (桜鳥)</span>
            </h2>
            <p className="text-xs sm:text-sm text-washi-300 leading-relaxed">
              Trong mỹ học truyền thống Nhật Bản, cái tên không chỉ để xưng hô, mà là chiếc la bàn định hình linh hồn và phẩm cách của người nghệ nhân.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Cánh Hoa Sakura */}
            <div className="p-6 rounded-2xl bg-sumi-950/80 border border-kin-500/20 hover:border-kin-400/50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-shu-950 border border-shu-600/40 flex items-center justify-center text-shu-400 font-serif font-bold text-xl">
                桜
              </div>
              <h3 className="font-serif text-lg font-bold text-washi-100">Sakura (Hoa Anh Đào)</h3>
              <p className="text-xs text-washi-300 leading-relaxed font-light">
                Biểu tượng của khoảnh khắc hoàn mỹ ngắn ngủi – triết lý <em>Mono no aware</em> (物の哀れ). Nhắc nhở người đầu bếp phải trân quý từng nhát dao, từng đĩa cá như thể đó là cơ hội duy nhất trong đời để dâng tặng vẻ đẹp trọn vẹn nhất cho người thưởng thức.
              </p>
            </div>

            {/* Cánh Chim Tori */}
            <div className="p-6 rounded-2xl bg-sumi-950/80 border border-kin-500/20 hover:border-kin-400/50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sumi-900 border border-kin-500/40 flex items-center justify-center text-kin-400 font-serif font-bold text-xl">
                鳥
              </div>
              <h3 className="font-serif text-lg font-bold text-washi-100">Tori (Cánh Chim Tự Do)</h3>
              <p className="text-xs text-washi-300 leading-relaxed font-light">
                Hình ảnh loài chim thiên di vượt hàng ngàn hải lý băng qua đại dương, biểu trưng cho lòng kiên trì không quản gian nan để kiếm tìm nguồn nguyên liệu thanh khiết nhất, và sự tận tụy sải cánh phụng sự từ đáy lòng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CHƯƠNG II: TỨ ĐẠI TRỤ CỘT TRIẾT LÝ ẨM THỰC */}
      <section className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold font-mono">
            Tôn Chỉ Hoạt Động • 四大哲学
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-washi-100">
            Tứ Đại Trụ Cột Triết Lý Cốt Lõi
          </h2>
          <p className="text-xs sm:text-sm text-washi-300">
            Mỗi món ăn tại Tori Sakura là sự hội tụ chuẩn mực của 4 giá trị bất biến qua hàng thế kỷ.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              kanji: '一期一会',
              romaji: 'Ichigo Ichie',
              title: 'Nhất Kỳ Nhất Hội',
              sub: 'Trân Quý Từng Khoảnh Khắc',
              desc: 'Cuộc hội ngộ hôm nay giữa bạn và nhà hàng là duy nhất trong đời, không bao giờ lặp lại. Bếp trưởng dành trọn tâm lực cho từng nhát dao, từng đĩa gốm mộc để tạo nên kỷ niệm ẩm thực không thể nào quên.',
              icon: Sparkles,
            },
            {
              kanji: '旬',
              romaji: 'Shun',
              title: 'Mỹ Vị Đỉnh Cao Bốn Mùa',
              sub: 'Nhịp Điệu Đất Trời',
              desc: 'Tôn trọng quy luật tự nhiên: ăn cá bơn khi tiết trời chớm đông, thưởng thức măng non ngọt giòn khi xuân sang, và bồi bổ lươn nướng than hoa khi hè về. Nguyên liệu chỉ được thu hoạch ở đúng thời khắc thăng hoa nhất.',
              icon: Compass,
            },
            {
              kanji: 'こだわり',
              romaji: 'Kodawari',
              title: 'Sự Cầu Toàn Cực Đoan',
              sub: 'Kỷ Luật Của Bậc Thầy',
              desc: 'Đo nhiệt độ cơm giấm Shari chuẩn xác 36.5°C bằng thân nhiệt, góc nghiêng lưỡi dao Yanagiba 45 độ bảo toàn từng sợi tế bào cá ngừ, và nồi nước dùng Tonkotsu khuấy đều tay suốt 18 tiếng không ngừng nghỉ.',
              icon: Award,
            },
            {
              kanji: 'おもてなし',
              romaji: 'Omotenashi',
              title: 'Hiếu Khách Vô Điều Kiện',
              sub: 'Tận Tụy Từ Trái Tim',
              desc: 'Nghệ thuật phục vụ không chỉ là bưng bê, mà là sự thấu cảm không lời: châm chén trà xanh nóng trước khi nước nguội, chuẩn bị chiếc khăn ấm thơm hương sả chanh dịu mát xoa dịu đôi tay sau ngày dài phố thị.',
              icon: Heart,
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-6 sm:p-7 rounded-3xl bg-sumi-900/80 border border-kin-500/20 hover:border-kin-500/50 shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-kanji text-kin-400 font-bold tracking-widest">{item.kanji}</span>
                  <item.icon className="w-5 h-5 text-kin-400/50 group-hover:text-kin-400 transition-colors" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-washi-100">{item.title}</h3>
                  <span className="text-[11px] font-mono text-kin-300 font-medium block">{item.romaji} • {item.sub}</span>
                </div>
                <p className="text-xs text-washi-300 leading-relaxed pt-1">{item.desc}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-sumi-800 flex items-center justify-end">
                <span className="text-[10px] text-kin-400/60 font-mono">TORI SAKURA WAY</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. CHƯƠNG III: BẾP TRƯỞNG KENJIRO TAKAHASHI - 25 NĂM LỬA NGHỀ */}
      <section className="bg-sumi-900/90 border border-kin-500/30 rounded-3xl p-6 sm:p-10 lg:p-14 shadow-2xl relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Chef Portrait */}
          <div className="lg:col-span-5 relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden border-2 border-kin-500/40 shadow-2xl relative">
              <img
                src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80"
                alt="Master Chef Kenjiro Takahashi"
                className="w-full h-full object-cover filter contrast-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sumi-950 via-transparent to-transparent opacity-60" />
            </div>

            <div className="absolute -bottom-4 -right-2 sm:-bottom-5 sm:-right-4 bg-gradient-to-r from-shu-900 to-shu-800 border-2 border-kin-400 p-4 rounded-2xl text-center shadow-gold-glow">
              <p className="text-base sm:text-lg font-sans font-bold text-kin-400">25 Năm</p>
              <p className="text-[10px] text-kin-300 uppercase tracking-widest font-mono">Đẳng Cấp Ginza Tokyo</p>
            </div>
          </div>

          {/* Chef Bio & Philosophy */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold font-mono">
                Bếp Trưởng Điều Hành • 総料理長
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-washi-100">
                Nghệ Nhân Kenjiro Takahashi
              </h2>
              <p className="text-xs font-kanji text-kin-400">高橋 健二郎 氏 — Bậc Thầy Dao Kiếm Edomae</p>
            </div>

            {/* Chef Quote */}
            <div className="bg-sumi-950/80 border-l-4 border-kin-400 p-4 rounded-r-2xl space-y-2">
              <Quote className="w-5 h-5 text-kin-400/60" />
              <p className="text-xs sm:text-sm text-washi-200 italic leading-relaxed">
                "Món ăn Nhật Bản không dùng gia vị gắt gỏng để che giấu khuyết điểm, mà dùng kỹ thuật tinh vi nhất để tôn vinh sự ngọt lành nguyên thủy mà Đất và Biển cả ban tặng. Khi bạn ăn một miếng cá, bạn phải thấy được cả đại dương trong lòng bàn tay."
              </p>
              <span className="text-[10px] text-kin-400 block font-mono">— Kenjiro Takahashi</span>
            </div>

            <p className="text-xs sm:text-sm text-washi-300 leading-relaxed font-light">
              Tốt nghiệp thủ khoa Học viện Ẩm thực Tsuji danh tiếng bậc nhất Osaka, Chef Takahashi đã dành trọn hơn hai thập kỷ tôi luyện tay nghề tại các ngôi đền ẩm thực Kaiseki 2 sao Michelin ở quận Ginza sầm uất. Đặt chân đến Việt Nam, ông mang theo toàn bộ bộ dao Sakai Takayuki rèn thủ công bằng thép xanh Aogami, cùng công thức nước tương Dashi gia truyền ba thế hệ không thể sao chép.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-washi-200">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-kin-400 shrink-0 mt-0.5" />
                <span>Chứng chỉ Bậc thầy xử lý Sashimi cao cấp do Bộ Nông Lâm Thủy Sản Nhật Bản (MAFF) chứng nhận.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-kin-400 shrink-0 mt-0.5" />
                <span>Trực tiếp thẩm định từng lô cá ngừ Hon Maguro, sò điệp tuyết và bò Wagyu nhập cảng mỗi ngày.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CHƯƠNG IV: BẢN GIAO HƯỞNG CỦA 4 NGUỒN NGUYÊN LIỆU ĐẮT GIÁ */}
      <section className="space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold font-mono">
            Tuyển Trạch Nghiêm Ngặt • 厳選食材
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-washi-100">
            Nguồn Nguyên Liệu Thượng Tuyển
          </h2>
          <p className="text-xs sm:text-sm text-washi-300 leading-relaxed">
            Chúng tôi không thỏa hiệp với chất lượng trung bình. Mỗi đĩa ăn trên bàn của bạn là kết tinh của những chuyến bay hỏa tốc và sự chắt lọc gắt gao nhất.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Toyosu Seafood */}
          <div className="p-6 sm:p-8 rounded-3xl bg-sumi-900 border border-kin-500/25 hover:border-kin-400/50 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-sumi-950 border border-kin-500/30 flex items-center justify-center text-kin-400 shadow-gold-glow">
                <Fish className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-sumi-950 text-kin-300 border border-kin-500/30 font-mono">
                Bay Hỏa Tốc 24H
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-washi-100">Hải Sản Đấu Giá Toyosu Tokyo</h3>
            <p className="text-xs sm:text-sm text-washi-300 leading-relaxed font-light">
              Cá ngừ đại dương O-Toro, Chutoro, Akami được đấu giá lúc 4:30 sáng tại chợ Toyosu (Tokyo). Áp dụng kỹ thuật gây tê tủy sống <strong>Ikejime</strong> bảo toàn 100% hợp chất ngọt tự nhiên ATP, đóng gói lạnh chuyên dụng bay thẳng về Tân Sơn Nhất trước giờ mở cửa đón khách.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-kin-300/80">
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#HonMaguro</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#UniHokkaido</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#HotateHokkaido</span>
            </div>
          </div>

          {/* Card 2: Wagyu A5 */}
          <div className="p-6 sm:p-8 rounded-3xl bg-sumi-900 border border-kin-500/25 hover:border-kin-400/50 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-shu-950 border border-shu-600/40 flex items-center justify-center text-shu-400 shadow-md">
                <Flame className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-shu-950 text-kin-300 border border-shu-600/50 font-mono">
                BMS 10 - 12 Tuyệt Đối
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-washi-100">Bò Wagyu A5 Miyazaki Đen Tajima</h3>
            <p className="text-xs sm:text-sm text-washi-300 leading-relaxed font-light">
              Từng 3 lần đoạt cúp quán quân Olympic Wagyu toàn Nhật Bản. Vân mỡ tuyết cẩm thạch dày đặc chứa lượng axit béo Oleic không no dồi dào có nhiệt độ nóng chảy thấp kỳ diệu ở <strong>25°C</strong> – tan biến mềm mại như bơ ấm ngay khi vừa đặt lên đầu lưỡi.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-kin-300/80">
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#WagyuA5</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#MiyazakiOlympic</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#SirloinBMS10</span>
            </div>
          </div>

          {/* Card 3: Tonkotsu Broth */}
          <div className="p-6 sm:p-8 rounded-3xl bg-sumi-900 border border-kin-500/25 hover:border-kin-400/50 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-sumi-950 border border-kin-500/30 flex items-center justify-center text-kin-400 shadow-gold-glow">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-sumi-950 text-kin-300 border border-kin-500/30 font-mono">
                18 Giờ Lửa Cuộn
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-washi-100">Nước Dùng Áp Suất Tonkotsu 18 Tiếng</h3>
            <p className="text-xs sm:text-sm text-washi-300 leading-relaxed font-light">
              Hàng trăm ký xương tủy heo tươi ninh áp suất cực đại sôi sùng sục ngày đêm. Hiện tượng nhũ hóa tự nhiên biến tủy xương thành dòng sữa ngọc trai sánh mịn béo ngậy, hòa quyện cùng tảo bẹ Kombu đảo Rishiri cho vị ngọt umami sâu thẳm không hóa chất.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-kin-300/80">
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#HakataTonkotsu</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#RishiriKombu</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#NoMSG</span>
            </div>
          </div>

          {/* Card 4: Gạo Koshihikari & Nước Tương Shoyu */}
          <div className="p-6 sm:p-8 rounded-3xl bg-sumi-900 border border-kin-500/25 hover:border-kin-400/50 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-sumi-950 border border-kin-500/30 flex items-center justify-center text-kin-400 shadow-gold-glow">
                <Utensils className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-sumi-950 text-kin-300 border border-kin-500/30 font-mono">
                Gạo Niigata & Tương 200 Năm
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-washi-100">Gạo Koshihikari & Nước Tương Thùng Tuyết Tùng</h3>
            <p className="text-xs sm:text-sm text-washi-300 leading-relaxed font-light">
              Từng hạt gạo Koshihikari được tưới bằng nước tuyết tan từ dãy núi Niigata, dẻo thơm óng ả. Cơm sushi được ủ với giấm đỏ Akasu cổ truyền và chấm cùng nước tương Shoyu ủ ròng rã 2 năm trong thùng gỗ tuyết tùng cổ thụ của thị trấn Yuasa.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-kin-300/80">
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#Koshihikari</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#AkasuVinegar</span>
              <span className="px-2 py-0.5 rounded bg-sumi-950 border border-sumi-800">#CedarShoyu</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CHƯƠNG V: KHÔNG GIAN THIỀN ĐỊNH WABI-SABI */}
      <section className="bg-sumi-900/60 border border-kin-500/20 rounded-3xl p-6 sm:p-12 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs uppercase tracking-widest text-kin-400 font-semibold font-mono">
            Kiến Trúc Thiền Tông • 空間の美学
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-washi-100">
            Không Gian Trầm Mặc & Tĩnh Tại
          </h2>
          <p className="text-xs sm:text-sm text-washi-300">
            Một chốn trú ẩn an yên giữa phố thị tấp nập, nơi thời gian như ngừng trôi để nhường chỗ cho vị giác thăng hoa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-sumi-950 border border-sumi-800 rounded-2xl p-5 space-y-3">
            <h4 className="font-serif font-bold text-base text-washi-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-kin-400" />
              <span>Sushi Bar Omakase Counter</span>
            </h4>
            <p className="text-xs text-washi-300 leading-relaxed font-light">
              Mặt bàn bằng gỗ bách Hinoki nguyên khối tỏa hương thơm mộc ngát. Nơi bạn ngồi đối diện nghệ nhân, trực tiếp thưởng lãm từng đường dao điêu luyện và nhấm nháp viên sushi tươi rói vừa rời tay đầu bếp.
            </p>
          </div>

          <div className="bg-sumi-950 border border-sumi-800 rounded-2xl p-5 space-y-3">
            <h4 className="font-serif font-bold text-base text-washi-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-shu-500" />
              <span>Phòng Chiếu Cói Tatami Truyền Thống</span>
            </h4>
            <p className="text-xs text-washi-300 leading-relaxed font-light">
              Chiếu cói Igusa thơm mùi cỏ đồng nội Nhật Bản, vách ngăn giấy dó Shoji mờ ảo và bàn thấp Horigotatsu có khoang để chân thoải mái, hoàn hảo cho những bữa tiệc gia đình sum vầy đầm ấm.
            </p>
          </div>

          <div className="bg-sumi-950 border border-sumi-800 rounded-2xl p-5 space-y-3">
            <h4 className="font-serif font-bold text-base text-washi-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Phòng VIP Thương Gia Sang Trọng</span>
            </h4>
            <p className="text-xs text-washi-300 leading-relaxed font-light">
              Không gian cách âm tuyệt đối, hệ thống hút khói âm sàn công nghệ Nhật, tủ trưng bày rượu Sake quý hiếm và nhân viên phục vụ riêng biệt, thích hợp cho những buổi tiếp đãi đối tác ngoại giao quan trọng.
            </p>
          </div>
        </div>
      </section>

      {/* 7. LỜI MỜI THỰC KHÁCH & CTA VÀNG */}
      <section className="bg-gradient-to-r from-shu-950 via-sumi-900 to-shu-950 border-2 border-kin-500/50 rounded-3xl p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-kanji text-kin-400 tracking-widest font-bold">心よりお待ちしております</span>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-washi-100">
            Kính Mời Quý Khách Đến Thưởng Thức
          </h2>
          <p className="text-xs sm:text-sm text-washi-300 font-light leading-relaxed">
            Dù là một buổi hẹn hò lãng mạn dưới ánh đèn lồng dịu nhẹ, một bữa cơm gia đình đầm ấm hay một dạ tiệc Omakase tinh tế, Tori Sakura luôn sẵn lòng mở cửa đón chào và phục vụ bạn bằng tất cả lòng thành kính.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/reservation"
            className="px-8 py-3.5 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/50 shadow-gold-glow flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <Calendar className="w-4 h-4 text-kin-300" />
            <span>Đặt Bàn Trực Tuyến Ngay</span>
          </Link>

          <Link
            to="/menu"
            className="px-8 py-3.5 rounded-full text-xs sm:text-sm font-bold text-kin-300 bg-sumi-950 border border-kin-500/40 hover:border-kin-400 hover:text-white transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            <span>Khám Phá Menu Lật Sách 3D</span>
          </Link>
        </div>
      </section>

    </div>
  );
};
