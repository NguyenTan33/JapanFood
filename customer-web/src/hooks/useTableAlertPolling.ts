import { useEffect, useRef } from 'react';
import { posService, TableAlert } from '@/services/posService';

/**
 * Polling thông báo từ khách tại bàn (Giục món / Gọi tính tiền) và phát lại thành window CustomEvent
 * để các màn hình (KDS, POS) đang lắng nghe 'torisakura_kitchen_buzz' / 'torisakura_bill_call' xử lý.
 */
export function useTableAlertPolling(
  type: 'KITCHEN_BUZZ' | 'BILL_CALL',
  enabled = true,
  intervalMs = 5000
) {
  const lastIdRef = useRef<number | null>(null);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const parseUtc = (s: string) => {
      const v = String(s || '').trim();
      return new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).getTime();
    };

    const dispatch = (a: TableAlert) => {
      const eventName = a.type === 'KITCHEN_BUZZ' ? 'torisakura_kitchen_buzz' : 'torisakura_bill_call';
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            id: a.id,
            tableId: a.tableId,
            tableNumber: a.tableNumber,
            totalAmount: a.totalAmount,
            note: a.note,
            timestamp: new Date(parseUtc(a.createdAt)).toLocaleTimeString('vi-VN'),
          },
        })
      );
    };

    const poll = async () => {
      if (inFlightRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      inFlightRef.current = true;
      try {
        const isFirst = lastIdRef.current === null;
        const res = await posService.getTableAlerts(lastIdRef.current ?? 0, type);
        if (cancelled) return;
        const now = Date.now();
        res.items.forEach((a) => {
          // Lần đầu chỉ phát lại các thông báo vừa xảy ra trong 7 giây gần nhất
          if (!isFirst || now - parseUtc(a.createdAt) <= 7000) dispatch(a);
        });
        lastIdRef.current = res.latestId;
      } catch {
        // bỏ qua lỗi mạng tạm thời
      } finally {
        inFlightRef.current = false;
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [type, enabled, intervalMs]);
}

/** Phát tiếng chuông ngắn bằng WebAudio (không cần file âm thanh) */
export function playAlertChime(times = 2) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % 2 === 0 ? 880 : 660;
      const start = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    }
    setTimeout(() => void ctx.close(), times * 400 + 200);
  } catch {
    // ignore
  }
}
