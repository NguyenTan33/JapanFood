using API.Security;
using Application.DTOs.Cart;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize]
[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
[Route("api/cart")]
public class CartController : BaseApiController
{
    private readonly ICartQueryRepository _cartQueryRepo;
    private readonly ICartService _cartService;

    public CartController(
        ICartQueryRepository cartQueryRepo,
        ICartService cartService)
    {
        _cartQueryRepo = cartQueryRepo;
        _cartService = cartService;
    }

    /// <summary>
    /// Xem giỏ hàng trực tuyến của tài khoản hiện tại kèm tổng tiền
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(CartViewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyCart(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để xem giỏ hàng." });
        }

        var cart = await _cartQueryRepo.GetUserCartAsync(userId.Value, ct);
        return Ok(cart);
    }

    /// <summary>
    /// Thêm món ăn vào giỏ hàng (kèm tùy chọn Topping / Modifiers)
    /// </summary>
    [HttpPost("items")]
    [ProducesResponseType(typeof(CartViewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> AddToCart([FromBody] AddToCartRequestDto request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để thêm vào giỏ hàng." });
        }

        request.UserId = userId.Value;
        var updatedCart = await _cartService.AddToCartAsync(request, ct);
        return Ok(updatedCart);
    }

    /// <summary>
    /// Cập nhật số lượng của một món trong giỏ hàng
    /// </summary>
    [HttpPut("items/{id:int}")]
    [ProducesResponseType(typeof(CartViewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateQuantity(int id, [FromBody] UpdateCartQuantityRequest request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập." });
        }

        var updatedCart = await _cartService.UpdateQuantityAsync(userId.Value, id, request.Quantity, ct);
        return Ok(updatedCart);
    }

    /// <summary>
    /// Xóa một món khỏi giỏ hàng
    /// </summary>
    [HttpDelete("items/{id:int}")]
    [ProducesResponseType(typeof(CartViewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RemoveCartItem(int id, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập." });
        }

        var updatedCart = await _cartService.RemoveItemAsync(userId.Value, id, ct);
        return Ok(updatedCart);
    }

    /// <summary>
    /// Xóa toàn bộ giỏ hàng
    /// </summary>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ClearCart(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập." });
        }

        await _cartService.ClearCartAsync(userId.Value, ct);
        return Ok(new { message = "Đã dọn sạch giỏ hàng thành công." });
    }
}

public class UpdateCartQuantityRequest
{
    public int Quantity { get; set; }
}
