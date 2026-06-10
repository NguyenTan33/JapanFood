using API.Security;
using Application.DTOs.Ordering;
using Application.Interfaces.Payment;
using Application.Interfaces.Services;
using Domain.Constants;
using Domain.Entities.Payment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[EnableRateLimiting(RateLimiterExtensions.PaymentPolicy)]
[Route("api/payments")]
public class PaymentController : BaseApiController
{
    private readonly IOrderService _orderService;
    private readonly IVnPayService _vnPayService;
    private readonly ILogger<PaymentController> _logger;

    public PaymentController(
        IOrderService orderService,
        IVnPayService vnPayService,
        ILogger<PaymentController> logger)
    {
        _orderService = orderService;
        _vnPayService = vnPayService;
        _logger = logger;
    }

    /// <summary>
    /// URL chuyển hướng khách quay về Website sau khi hoàn tất thanh toán trên cổng VnPay
    /// </summary>
    [AllowAnonymous]
    [HttpGet("vnpay-return")]
    public async Task<IActionResult> VnPayReturn(CancellationToken ct)
    {
        var queryParams = Request.Query.ToDictionary(k => k.Key, v => v.Value.ToString());
        var vnpSecureHash = Request.Query["vnp_SecureHash"].ToString();

        var isValid = _vnPayService.ValidateSignature(queryParams, vnpSecureHash);
        var responseCode = Request.Query["vnp_ResponseCode"].ToString();
        var txnRef = Request.Query["vnp_TxnRef"].ToString();

        if (isValid && responseCode == "00")
        {
            await _orderService.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, queryParams, ct);
            return Ok(new
            {
                success = true,
                message = "Thanh toán đơn hàng thành công qua VNPAY.",
                transactionNumber = txnRef
            });
        }

        return BadRequest(new
        {
            success = false,
            message = "Giao dịch thanh toán không thành công hoặc chữ ký không hợp lệ.",
            responseCode
        });
    }

    /// <summary>
    /// Webhook IPN chạy ngầm từ máy chủ VnPay thông báo kết quả giao dịch thanh toán
    /// </summary>
    [AllowAnonymous]
    [HttpGet("vnpay-ipn")]
    public async Task<IActionResult> VnPayIpn(CancellationToken ct)
    {
        try
        {
            var queryParams = Request.Query.ToDictionary(k => k.Key, v => v.Value.ToString());
            var success = await _orderService.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, queryParams, ct);

            if (success)
            {
                return Ok(new { RspCode = "00", Message = "Confirm Success" });
            }

            return Ok(new { RspCode = "97", Message = "Invalid Checksum" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi xảy ra trong quá trình xử lý VnPay IPN");
            return Ok(new { RspCode = "99", Message = "Unknown error" });
        }
    }

    /// <summary>
    /// Webhook IPN chạy ngầm từ máy chủ MoMo thông báo kết quả giao dịch thanh toán
    /// </summary>
    [AllowAnonymous]
    [HttpPost("momo-ipn")]
    public async Task<IActionResult> MoMoIpn([FromBody] Dictionary<string, string> callbackData, CancellationToken ct)
    {
        var success = await _orderService.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData, ct);
        if (success)
        {
            return NoContent();
        }

        return BadRequest(new { message = "Xác thực chữ ký MoMo thất bại." });
    }

    /// <summary>
    /// Thu ngân xác nhận thu tiền mặt tại quầy: Nhập số tiền khách đưa -> Tự động tính tiền thối lại -> Hoàn tất đơn và giải phóng bàn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [HttpPost("cash-confirm")]
    [ProducesResponseType(typeof(ConfirmCashPaymentResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ConfirmCashPayment([FromBody] ConfirmCashPaymentRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        var result = await _orderService.ConfirmCashPaymentWithChangeAsync(request, staffUserId.Value, ct);
        return Ok(result);
    }
}
