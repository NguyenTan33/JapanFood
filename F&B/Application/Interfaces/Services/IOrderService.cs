using Application.DTOs.Ordering;
using Domain.Entities.Payment;

namespace Application.Interfaces.Services;

public interface IOrderService
{
    Task<OrderDetailViewDto> CreateOrderAsync(CreateOrderRequestDto request, CancellationToken ct = default);
    Task<bool> SendOrderToKitchenAsync(int orderId, int staffUserId, CancellationToken ct = default);
    Task<string> CheckoutOrderAsync(int orderId, PaymentGateway gateway, string ipAddress, string returnUrl, CancellationToken ct = default);
    Task<bool> ProcessPaymentCallbackAsync(PaymentGateway gateway, IDictionary<string, string> callbackData, CancellationToken ct = default);
    Task<bool> CancelOrderAsync(int orderId, string reason, int staffUserId, CancellationToken ct = default);

    // Luồng 1: Quản lý đơn hàng Online (Duyệt đơn, Bếp nấu, Xuất đơn)
    Task<List<OnlinePendingOrderDto>> GetPendingOnlineOrdersAsync(CancellationToken ct = default);
    Task<bool> ApproveOnlineOrderAsync(ApproveOnlineOrderRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<List<OnlinePendingOrderDto>> GetOrdersReadyForDispatchAsync(CancellationToken ct = default);
    Task<bool> DispatchOnlineOrderAsync(int orderId, int staffUserId, CancellationToken ct = default);
    Task<bool> CompleteOnlineOrderDeliveryAsync(int orderId, int userId, bool isStaff, CancellationToken ct = default);

    // Luồng 2: Khách quét QR tự gọi món tại bàn (Nhảy trực tiếp vào bếp KDS)
    Task<TableQrSessionResponseDto> GetTableQrSessionAsync(int tableId, string? token, string? clientIp, CancellationToken ct = default);
    Task<TableQrOrderResponseDto> CreateQrTableOrderAsync(TableQrOrderRequestDto request, string? clientIp, CancellationToken ct = default);

    // Quyền hạn tối cao POS: Thêm món, Hủy món, Tách bàn
    Task<OrderDetailViewDto> AddItemsToOrderAsync(AddOrderItemsRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<bool> CancelOrderItemAsync(CancelOrderItemRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<bool> SplitOrderAsync(SplitOrderRequestDto request, int staffUserId, CancellationToken ct = default);

    // Thanh toán: Tiền mặt tính tiền thối & Sinh mã VietQR động
    Task<ConfirmCashPaymentResponseDto> ConfirmCashPaymentWithChangeAsync(ConfirmCashPaymentRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<VietQrPaymentResponseDto> GetVietQrForOrderAsync(int orderId, CancellationToken ct = default);
}
