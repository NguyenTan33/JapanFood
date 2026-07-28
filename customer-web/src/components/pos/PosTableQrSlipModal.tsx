import React from 'react';
import { createPortal } from 'react-dom';
import { QrCode, Printer, X, Wifi, ExternalLink } from 'lucide-react';
import { PosTable } from '@/services/posService';

interface PosTableQrSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: PosTable | null;
  sessionToken?: string;
  pinCode?: string;
}

export const PosTableQrSlipModal: React.FC<PosTableQrSlipModalProps> = ({
  isOpen,
  onClose,
  table,
  sessionToken,
  pinCode,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen || !table || typeof document === 'undefined') return null;

  const resolvedToken = sessionToken || `table_${table.tableId}_order_${table.currentOrderId || 'active'}`;
  const origin = window.location.origin;
  const tableOrderUrl = `${origin}/table-order?tableId=${table.tableId}&token=${encodeURIComponent(
    resolvedToken
  )}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    tableOrderUrl
  )}`;

  const handlePrint = () => {
    window.print();
  };

  const handleOpenClientView = () => {
    window.open(tableOrderUrl, '_blank');
  };

  return createPortal(
    <div
      className="thermal-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="thermal-modal-card relative w-full max-w-sm bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 max-h-[92vh] flex flex-col my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header Bar with prominent X button */}
        <div className="no-print shrink-0 flex items-center justify-between px-4 py-3 bg-slate-100 border-b border-slate-200 z-10">
          <div className="flex items-center gap-2 text-emerald-700">
            <QrCode className="w-4 h-4" />
            <span className="font-bold text-xs uppercase tracking-wider">
              Phiếu QR Đặt Tại Bàn (Dine-In)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng phiếu QR"
            title="Đóng (Esc)"
            className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-red-500 hover:text-white text-slate-700 rounded-full transition-all shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 80mm Slip Content (Scrollable if height exceeds screen) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 font-mono text-xs leading-relaxed text-center bg-white text-black" id="printable-table-qr-slip">
          {/* Brand header */}
          <div className="pb-3 border-b-2 border-dashed border-slate-400">
            <h2 className="text-lg font-black uppercase tracking-tight text-black">
              SAKURA JAPAN FOOD
            </h2>
            <p className="text-[11px] text-slate-600 font-sans">
              Ẩm Thực Nhật Bản Truyền Thống
            </p>
            <div className="mt-2 inline-block px-3 py-1 bg-white text-black border-2 border-black font-black text-sm rounded">
              PHIẾU GỌI MÓN TẠI BÀN
            </div>
          </div>

          {/* Table info */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1">
            <div className="text-2xl font-black text-black tracking-wider">
              {table.tableNumber}
            </div>
            <p className="text-[11px] text-slate-700 font-sans">
              Khu vực: {table.areaName} • Sức chứa: {table.capacity} khách
            </p>
            <p className="text-[10px] text-slate-500">
              Giờ mở bàn:{' '}
              {table.openedAt
                ? new Date(table.openedAt).toLocaleString('vi-VN')
                : new Date().toLocaleString('vi-VN')}
            </p>
          </div>

          {/* QR Code */}
          <div className="py-4 flex flex-col items-center justify-center">
            <div className="p-2.5 bg-white border-2 border-dashed border-slate-800 rounded-xl inline-block">
              <img
                src={qrImageUrl}
                alt={`QR Bàn ${table.tableNumber}`}
                className="w-44 h-44 object-contain"
              />
            </div>
            <p className="text-[11px] font-bold text-slate-900 uppercase mt-2">
              Quét Mã Để Xem Menu &amp; Gọi Món
            </p>
          </div>

          {/* WiFi instruction */}
          <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-left space-y-1 font-sans text-[11px] text-slate-900">
            <div className="flex items-center gap-1.5 font-bold pb-0.5 border-b border-slate-200">
              <Wifi className="w-3.5 h-3.5" />
              <span>YÊU CẦU KẾT NỐI WIFI QUÁN:</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span>Tên WiFi:</span>
              <span className="font-bold text-black font-mono">Sakura_Guest_5G</span>
            </div>
            <div className="flex justify-between">
              <span>Mật khẩu:</span>
              <span className="font-bold text-black font-mono">sakura8888</span>
            </div>
            <p className="text-[10px] text-slate-600 italic pt-1 border-t border-slate-200 mt-1">
              * Quý khách vui lòng kết nối đúng WiFi nhà hàng để gửi order trực tiếp xuống bếp.
            </p>
          </div>

          {/* Footer note */}
          <div className="pt-3 text-[10px] text-slate-600 font-sans">
            <p>Hỗ trợ chuông giục bếp &amp; gọi tính tiền trực tiếp</p>
            <p className="font-semibold text-black mt-0.5">Chúc Quý Khách Ngon Miệng! (いただきます)</p>
          </div>
        </div>

        {/* Sticky Modal Buttons Bar */}
        <div className="no-print shrink-0 flex flex-col gap-2 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 font-sans z-10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>In Phiếu Để Trên Bàn</span>
            </button>
            <button
              type="button"
              onClick={handleOpenClientView}
              className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              title="Mở giao diện khách trên tab mới"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Mở Xem Thử</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Đóng</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
