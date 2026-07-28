import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Phone, 
  Clock, 
  Navigation, 
  Calendar, 
  Building2, 
  Car,
  Loader2
} from 'lucide-react';
import { branchService } from '@/services/branchService';
import { BranchLocation } from '@/types';

export const LocationPage: React.FC = () => {
  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchBranches() {
      try {
        const list = await branchService.getBranches();
        if (!isMounted) return;
        setBranches(list);
        if (list.length > 0) {
          setSelectedBranchId(list[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách chi nhánh:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchBranches();
    return () => { isMounted = false; };
  }, []);

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-kin-400 animate-spin" />
      </div>
    );
  }

  if (!activeBranch) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-washi-300">
        Không có chi nhánh nào đang hoạt động.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sumi-900 border border-kin-500/30 text-xs font-semibold text-kin-400 mb-2 shadow-gold-glow">
          <MapPin className="w-3.5 h-3.5" />
          <span>Hệ Thống Không Gian Ẩm Thực</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-washi-100">
          Vị Trí & Chi Nhánh Tori Sakura
        </h1>
        <p className="text-xs sm:text-sm text-washi-300 mt-2 font-light">
          Hiện diện tại những vị trí đắc địa nhất Sài Gòn & Thủ đô Hà Nội với kiến trúc Nhật Bản thanh tịnh.
        </p>
      </div>

      {/* Branch Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {branches.map((branch) => {
          const isSelected = branch.id === selectedBranchId;
          return (
            <button
              type="button"
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className={`p-4 rounded-2xl text-left border transition-all flex items-start space-x-3.5 ${
                isSelected
                  ? 'bg-shu-950/90 border-kin-400 text-white shadow-gold-glow'
                  : 'bg-sumi-900/80 border-kin-500/20 text-washi-300 hover:border-kin-500/50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isSelected ? 'bg-shu-700 border-kin-400 text-white' : 'bg-sumi-950 border-sumi-700 text-kin-400'
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-kanji text-kin-400 font-bold">{branch.japaneseName}</span>
                <h3 className="font-serif text-sm font-bold text-washi-100 truncate">{branch.name}</h3>
                <p className="text-xs text-washi-400 mt-0.5 truncate">{branch.address}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Location Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Branch Detailed Info */}
        <div className="lg:col-span-5 space-y-6">
          <div className="relative rounded-3xl overflow-hidden aspect-[16/10] border border-kin-500/30 shadow-2xl">
            <img
              src={activeBranch.imageUrl}
              alt={activeBranch.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sumi-950 via-sumi-950/40 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="text-xs font-kanji text-kin-400 font-bold">{activeBranch.japaneseName}</span>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">{activeBranch.name}</h2>
              {activeBranch.isFlagship && (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-kin-500/20 text-kin-300 border border-kin-500/40">
                  Flagship Store
                </span>
              )}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="p-6 rounded-3xl bg-sumi-900/90 border border-kin-500/25 space-y-4 text-xs text-washi-200">
            <div className="flex items-start space-x-3">
              <MapPin className="w-4 h-4 text-kin-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-washi-100">Địa chỉ:</p>
                <p className="text-washi-300 mt-0.5">{activeBranch.address}, {activeBranch.district}, {activeBranch.city}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 border-t border-sumi-800 pt-3">
              <Phone className="w-4 h-4 text-kin-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-washi-100">Hotline & Điện thoại bàn:</p>
                <p className="text-kin-300 mt-0.5 font-mono">{activeBranch.hotline} • {activeBranch.phone}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 border-t border-sumi-800 pt-3">
              <Clock className="w-4 h-4 text-kin-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-washi-100">Giờ hoạt động:</p>
                <p className="text-washi-300 mt-0.5">Ca Trưa: {activeBranch.openingHours.lunch}</p>
                <p className="text-washi-300">Ca Tối: {activeBranch.openingHours.dinner}</p>
                {activeBranch.openingHours.note && (
                  <p className="text-[11px] text-kin-400/80 italic mt-1">{activeBranch.openingHours.note}</p>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-3 border-t border-sumi-800 pt-3">
              <Car className="w-4 h-4 text-kin-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-washi-100">Thông tin bãi đỗ xe:</p>
                <p className="text-washi-300 mt-0.5"><strong className="text-washi-200">Xe máy:</strong> {activeBranch.parkingInfo.motorbike}</p>
                <p className="text-washi-300 mt-0.5"><strong className="text-washi-200">Ô tô:</strong> {activeBranch.parkingInfo.car}</p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={`/reservation?branch=${activeBranch.id}`}
              className="flex-1 py-3 px-5 rounded-2xl text-center text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 shadow-lg flex items-center justify-center space-x-2 transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span>Đặt Bàn Tại Chi Nhánh Này</span>
            </Link>

            <a
              href={activeBranch.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-5 rounded-2xl text-center text-xs font-semibold text-kin-300 bg-sumi-800 hover:bg-sumi-700 border border-kin-500/30 flex items-center justify-center space-x-2 transition-colors"
            >
              <Navigation className="w-4 h-4 text-kin-400" />
              <span>Chỉ Đường</span>
            </a>
          </div>
        </div>

        {/* Right Column: Google Maps Embed with Red Pin Indicator */}
        <div className="lg:col-span-7 bg-sumi-950 border border-kin-500/30 rounded-3xl overflow-hidden shadow-2xl relative min-h-[460px] sm:min-h-[560px] flex flex-col">
          <iframe
            title={`Bản đồ ${activeBranch.name}`}
            src={activeBranch.googleMapsEmbedUrl}
            width="100%"
            height="100%"
            className="w-full flex-1 min-h-[460px] sm:min-h-[560px] border-0"
            loading="lazy"
            allowFullScreen
          />

          {/* Top-left: Live Status Badge */}
          <div className="absolute top-4 left-4 bg-sumi-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-kin-500/40 text-[11px] font-semibold text-kin-400 shadow-lg flex items-center space-x-1.5 pointer-events-none z-20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span>Google Maps Trực Tuyến</span>
          </div>

          {/* Prominent Red Point Location Marker */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-20 flex flex-col items-center">
            <div className="px-3.5 py-1.5 rounded-xl bg-sumi-950/95 border border-kin-400/80 text-white text-xs font-bold shadow-2xl flex items-center space-x-2 whitespace-nowrap mb-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-shu-500 animate-ping shrink-0" />
              <span className="text-kin-300 font-kanji">桜</span>
              <span>{activeBranch.name}</span>
            </div>
            
            <div className="relative flex items-center justify-center">
              <span className="absolute w-12 h-12 rounded-full bg-shu-500/40 animate-ping" />
              <span className="absolute w-8 h-8 rounded-full bg-shu-600/60 animate-pulse" />
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-shu-500 via-shu-700 to-shu-900 border-2 border-white shadow-2xl flex items-center justify-center text-white">
                <MapPin className="w-5 h-5 text-kin-300 fill-shu-600 drop-shadow" />
              </div>
            </div>

            <div className="w-2.5 h-2.5 bg-shu-800 rotate-45 -mt-1 border-r border-b border-kin-400" />
            <div className="w-3.5 h-1.5 rounded-full bg-black/70 blur-[1px] mt-0.5" />
          </div>

          {/* Bottom-right: Open External Google Maps Button */}
          <a
            href={activeBranch.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 bg-sumi-900/95 hover:bg-shu-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-kin-500/40 text-xs font-semibold text-kin-300 hover:text-white shadow-2xl flex items-center space-x-1.5 transition-all z-20 group"
          >
            <Navigation className="w-3.5 h-3.5 text-kin-400 group-hover:rotate-45 transition-transform" />
            <span>Mở Trên Google Maps</span>
          </a>
        </div>
      </div>
    </div>
  );
};
