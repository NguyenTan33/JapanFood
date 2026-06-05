using API.Security;
using Application.Common.Models;
using Application.DTOs.Ordering;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Constants;
using Domain.Entities.Menu;
using Domain.Entities.Payment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
[Route("api/orders")]
public class OrderController : BaseApiController
{
    private readonly IOrderQueryRepository _orderQueryRepo;
    private readonly IOrderService _orderService;

    public OrderController(
        IOrderQueryRepository orderQueryRepo,
        IOrderService orderService)
    {
        _orderQueryRepo = orderQueryRepo;
        _orderService = orderService;
    }

    /// <summary>
    /// Tạo đơn hàng mới (Ăn tại quán DineIn / Mang về Takeaway / Giao hàng Delivery)
    /// </summary>
    [Authorize]
    [HttpPost]
    [ProducesResponseType(typeof(OrderDetailViewDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequestDto request, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return Unauthorized(new { message = "Token không hợp lệ hoặc thiếu thông tin tài khoản." });
        }

        if (!IsStaffOrHigher() || !request.UserId.HasValue)
        {
            request.UserId = currentUserId.Value;
        }

        var order = await _orderService.CreateOrderAsync(request, ct);
        if (request.Items != null && request.Items.Count > 0)
        {
            await _orderService.SendOrderToKitchenAsync(order.OrderId, currentUserId.Value, ct);
            order = await _orderQueryRepo.GetOrderWithDetailsByIdAsync(order.OrderId, ct) ?? order;
        }
        return StatusCode(StatusCodes.Status201Created, order);
    }

    /// <summary>
    /// Xem chi tiết đơn hàng (món ăn, toppings, thanh toán, trạng thái)
    /// </summary>
    [Authorize]
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(OrderDetailViewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrderById(int id, CancellationToken ct)
    {
        var order = await _orderQueryRepo.GetOrderWithDetailsByIdAsync(id, ct);
        if (order == null)
        {
            return NotFound(new { message = $"Không tìm thấy đơn hàng #{id}." });
        }

        if (!IsStaffOrHigher())
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized(new { message = "Vui lòng đăng nhập để xem đơn hàng." });
            }

            if (order.UserId != currentUserId.Value)
            {
                return Forbid();
            }
        }

        return Ok(order);
    }

    /// <summary>
    /// Xem lịch sử đơn hàng của tài khoản cá nhân
    /// </summary>
    [Authorize]
    [HttpGet("my-history")]
    [ProducesResponseType(typeof(PagedResult<OrderDetailViewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyOrderHistory(
        [FromQuery] OrderStatus? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để xem lịch sử đơn hàng." });
        }

        var result = await _orderQueryRepo.GetUserOrderHistoryAsync(userId.Value, status, fromDate, toDate, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Chuyển các món ăn mới trong đơn sang màn hình Bếp KDS
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("{id:int}/send-to-kitchen")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SendOrderToKitchen(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Không xác định được mã nhân viên." });
        }

        await _orderService.SendOrderToKitchenAsync(id, staffUserId.Value, ct);
        return Ok(new { message = "Đã chuyển các món mới sang màn hình bếp KDS." });
    }

    /// <summary>
    /// Khởi tạo thanh toán đơn hàng (VnPay / MoMo / Tiền mặt)
    /// </summary>
    [Authorize]
    [EnableRateLimiting(RateLimiterExtensions.PaymentPolicy)]
    [HttpPost("{id:int}/checkout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CheckoutOrder(int id, [FromBody] CheckoutOrderRequest request, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để thanh toán." });
        }

        var order = await _orderQueryRepo.GetOrderWithDetailsByIdAsync(id, ct);
        if (order == null)
        {
            return NotFound(new { message = $"Không tìm thấy đơn hàng #{id}." });
        }

        if (!IsStaffOrHigher() && order.UserId != currentUserId.Value)
        {
            return Forbid();
        }

        var ipAddress = GetClientIpAddress();
        var returnUrl = ResolveSafeReturnUrl(request.ReturnUrl, "/api/payments/vnpay-return");

        var paymentUrl = await _orderService.CheckoutOrderAsync(id, request.Gateway, ipAddress, returnUrl, ct);
        return Ok(new
        {
            orderId = id,
            gateway = request.Gateway.ToString(),
            paymentUrl
        });
    }

    /// <summary>
    /// Hủy đơn hàng
    /// </summary>
    [Authorize]
    [HttpPost("{id:int}/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelOrder(int id, [FromBody] CancelOrderRequest request, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để hủy đơn hàng." });
        }

        var order = await _orderQueryRepo.GetOrderWithDetailsByIdAsync(id, ct);
        if (order == null)
        {
            return NotFound(new { message = $"Không tìm thấy đơn hàng #{id}." });
        }

        if (!IsStaffOrHigher() && order.UserId != currentUserId.Value)
        {
            return Forbid();
        }

        await _orderService.CancelOrderAsync(id, request.Reason, currentUserId.Value, ct);
        return Ok(new { message = "Đã hủy đơn hàng thành công." });
    }

    /// <summary>
    /// [POS] Xem danh sách đơn hàng đặt Online (Takeaway / Delivery) đang chờ duyệt
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("pending-online")]
    [ProducesResponseType(typeof(List<OnlinePendingOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendingOnlineOrders(CancellationToken ct)
    {
        var orders = await _orderService.GetPendingOnlineOrdersAsync(ct);
        return Ok(orders);
    }

    /// <summary>
    /// [POS] Thu ngân duyệt đơn hàng đặt Online -> Hệ thống tự động phân luồng bắn món xuống trạm bếp KDS
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("approve-online")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ApproveOnlineOrder([FromBody] ApproveOnlineOrderRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _orderService.ApproveOnlineOrderAsync(request, staffUserId.Value, ct);
        return Ok(new { message = $"Đã duyệt đơn hàng #{request.OrderId} thành công. Món ăn đã được gửi xuống trạm bếp KDS." });
    }

    /// <summary>
    /// [POS] Xem danh sách đơn hàng Online đã được bếp nấu xong toàn bộ, sẵn sàng đóng gói xuất đơn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpGet("ready-for-dispatch")]
    [ProducesResponseType(typeof(List<OnlinePendingOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrdersReadyForDispatch(CancellationToken ct)
    {
        var orders = await _orderService.GetOrdersReadyForDispatchAsync(ct);
        return Ok(orders);
    }

    /// <summary>
    /// [POS] Thu ngân xác nhận xuất đơn hàng cho shipper hoặc trả cho khách mang đi
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("{id:int}/dispatch")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DispatchOrder(int id, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _orderService.DispatchOnlineOrderAsync(id, staffUserId.Value, ct);
        return Ok(new { message = $"Đã xuất đơn hàng #{id} đi giao thành công." });
    }

    /// <summary>
    /// [Khách hàng / POS] Xác nhận đã giao & nhận đơn hàng Online hoàn tất (Chuyển sang Completed & tích điểm thưởng)
    /// </summary>
    [Authorize]
    [HttpPost("{id:int}/complete-delivery")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CompleteOnlineOrderDelivery(int id, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để xác nhận đơn hàng." });
        }

        await _orderService.CompleteOnlineOrderDeliveryAsync(id, currentUserId.Value, IsStaffOrHigher(), ct);
        return Ok(new { message = $"Đã xác nhận nhận hàng hoàn tất cho đơn #{id}." });
    }

    /// <summary>
    /// [Khách tại bàn] Lấy thông tin bàn và danh sách món đã gọi theo phiên QR tại bàn
    /// </summary>
    [AllowAnonymous]
    [DisableRateLimiting]
    [HttpGet("table-qr-session")]
    [ProducesResponseType(typeof(TableQrSessionResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTableQrSession([FromQuery] int tableId, [FromQuery] string? token, CancellationToken ct)
    {
        var clientIp = GetClientIpAddress();
        var result = await _orderService.GetTableQrSessionAsync(tableId, token, clientIp, ct);
        return Ok(result);
    }

    /// <summary>
    /// [Khách tại bàn] Quét mã QR tự gọi món trên điện thoại (Yêu cầu kết nối đúng WiFi quán) -> Nhảy thẳng trạm bếp KDS
    /// </summary>
    [AllowAnonymous]
    [HttpPost("table-qr-order")]
    [ProducesResponseType(typeof(TableQrOrderResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateQrTableOrder([FromBody] TableQrOrderRequestDto request, CancellationToken ct)
    {
        var clientIp = GetClientIpAddress();
        var result = await _orderService.CreateQrTableOrderAsync(request, clientIp, ct);
        return Ok(result);
    }

    /// <summary>
    /// [POS] Thêm món ăn vào đơn hàng bàn đang mở (Khách gọi thêm món tại chỗ)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("items")]
    [ProducesResponseType(typeof(OrderDetailViewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> AddItemsToOrder([FromBody] AddOrderItemsRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        var result = await _orderService.AddItemsToOrderAsync(request, staffUserId.Value, ct);
        return Ok(result);
    }

    /// <summary>
    /// [POS] Hủy một món ăn cụ thể trong đơn của bàn (Đồng thời tự hủy trên phiếu bếp KDS)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("items/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelOrderItem([FromBody] CancelOrderItemRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _orderService.CancelOrderItemAsync(request, staffUserId.Value, ct);
        return Ok(new { message = $"Đã hủy món #{request.OrderItemId} khỏi đơn hàng #{request.OrderId} thành công." });
    }

    /// <summary>
    /// [POS] Tách bàn / Chuyển một số món từ bàn này sang bàn khác
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
    [HttpPost("split")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SplitOrder([FromBody] SplitOrderRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _orderService.SplitOrderAsync(request, staffUserId.Value, ct);
        return Ok(new { message = $"Đã tách các món được chọn sang bàn #{request.TargetTableId} thành công." });
    }

    /// <summary>
    /// Sinh mã Dynamic VietQR kèm đúng số tiền cần thanh toán của đơn hàng để khách quét trả tại bàn
    /// </summary>
    [Authorize]
    [HttpGet("{id:int}/vietqr")]
    [ProducesResponseType(typeof(VietQrPaymentResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetVietQrForOrder(int id, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (!IsStaffOrHigher())
        {
            var order = await _orderQueryRepo.GetOrderWithDetailsByIdAsync(id, ct);
            if (order == null || !currentUserId.HasValue || order.UserId != currentUserId.Value)
            {
                return Forbid();
            }
        }

        var result = await _orderService.GetVietQrForOrderAsync(id, ct);
        return Ok(result);
    }
}

public class CheckoutOrderRequest
{
    public PaymentGateway Gateway { get; set; } = PaymentGateway.VnPay;
    public string? ReturnUrl { get; set; }
}

public class CancelOrderRequest
{
    public string Reason { get; set; } = string.Empty;
}
