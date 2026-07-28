import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Utensils } from 'lucide-react';
import { KdsPrintTicketDto } from '@/services/kdsService';

export interface KitchenPrintData {
  restaurantName?: string;
  tableName: string;
  dishName: string;
  quantity: number;
  modifiersSummary?: string | null;
  specialInstructions?: string | null;
  orderedAtDisplay: string;
  completedAtDisplay: string;
  copyNumber?: number;
}

export const KdsThermalTicketContent: React.FC<{ ticket: KdsPrintTicketDto | KitchenPrintData }> = ({
  ticket,
}) => {
  const copyNumber = ticket.copyNumber ?? 1;
  const isReprint = copyNumber > 1;

  return (
    <div
      id="printable-kitchen-ticket"
      className="p-4 font-mono text-[12px] leading-snug text-black bg-white"
    >
      {/* Top Title */}
      <div className="text-center pb-2.5 border-b-2 border-dashed border-black">
        <h2 className="text-base font-black uppercase tracking-tight text-black">
          {ticket.restaurantName || 'SAKURA JAPAN FOOD'}
        </h2>
        <div className="mt-1.5 inline-block px-2.5 py-0.5 border border-black font-bold text-xs uppercase">
          {isReprint ? `PHIẾU BẾP (IN LẠI #${copyNumber})` : 'PHIẾU CHẾ BIẾN BẾP'}
        </div>
      </div>

      {/* Prominent Table & Timestamps */}
      <div className="py-2.5 border-b border-dashed border-black space-y-1 text-xs">
        <div className="flex justify-between items-center text-sm font-black">
          <span>BÀN:</span>
          <span className="px-2 py-0.5 border border-black font-black">{ticket.tableName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Giờ gọi:</span>
          <span className="font-semibold">{ticket.orderedAtDisplay}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Hoàn thành:</span>
          <span className="font-bold">{ticket.completedAtDisplay}</span>
        </div>
      </div>

      {/* Main Dish Content */}
      <div className="py-3 border-b-2 border-dashed border-black space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-black text-black leading-snug flex-1">{ticket.dishName}</p>
          <span className="text-base font-black px-2 py-0.5 border border-black shrink-0">
            x{ticket.quantity || 1}
          </span>
        </div>

        {ticket.modifiersSummary && ticket.modifiersSummary.trim() && (
          <p className="text-xs text-black italic">+ {ticket.modifiersSummary}</p>
        )}

        {ticket.specialInstructions && ticket.specialInstructions.trim() && (
          <div className="mt-1.5 p-1.5 border border-black text-xs text-black">
            <span className="font-bold uppercase">Ghi chú: </span>
            <span>{ticket.specialInstructions}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 text-center text-[11px] text-black">
        <p className="font-bold">Bản in: #{copyNumber}</p>
        <p className="mt-0.5 italic">Vui lòng phục vụ ra bàn!</p>
      </div>
    </div>
  );
};

interface KdsPrintFramePortalProps {
  ticket: KdsPrintTicketDto | null;
}

export const KdsPrintFramePortal: React.FC<KdsPrintFramePortalProps> = ({ ticket }) => {
  if (!ticket || typeof document === 'undefined') return null;

  return createPortal(
    <div id="kds-thermal-print-root" className="hidden print:block thermal-print-portal">
      <KdsThermalTicketContent ticket={ticket} />
    </div>,
    document.body
  );
};

interface KdsPrintTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: KitchenPrintData | null;
}

export const KdsPrintTicketModal: React.FC<KdsPrintTicketModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data || typeof document === 'undefined') return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="thermal-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="thermal-modal-card relative w-full max-w-sm bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-300">
        {/* Header Action Bar */}
        <div className="no-print flex items-center justify-between px-4 py-3 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-emerald-600 text-white">
              <Utensils className="w-4 h-4" />
            </span>
            <span className="font-bold text-xs tracking-wider uppercase text-slate-800">
              Phiếu Chế Biến Nhà Bếp (80mm)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2">
          <KdsThermalTicketContent ticket={data} />
        </div>

        {/* Modal Buttons */}
        <div className="no-print flex items-center gap-2 p-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>In Phiếu Ra Máy In Nhiệt</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
