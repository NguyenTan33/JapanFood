using Application.Common.Validation;
using Application.DTOs.Cart;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Entities.Ordering;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class CartService : ICartService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICartQueryRepository _cartQueryRepo;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<CartService> _logger;

    public CartService(
        IUnitOfWork unitOfWork,
        ICartQueryRepository cartQueryRepo,
        IValidationFactory validationFactory,
        ILogger<CartService> logger)
    {
        _unitOfWork = unitOfWork;
        _cartQueryRepo = cartQueryRepo;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<CartViewDto> AddToCartAsync(AddToCartRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 2. Verify dish existence and availability
        var menuItem = await _unitOfWork.Context.MenuItems
            .Include(m => m.ModifierGroups)
                .ThenInclude(mg => mg.ModifierGroup)
                    .ThenInclude(g => g.Options)
            .FirstOrDefaultAsync(m => m.Id == request.MenuItemId, ct);

        if (menuItem == null)
            throw new NotFoundException($"Không tìm thấy món ăn #{request.MenuItemId}.");

        if (!menuItem.IsAvailable)
            throw new BusinessException($"Món '{menuItem.Name}' hiện đã hết hoặc ngừng phục vụ.");

        // 3. Find existing cart items for this user and dish
        var userCartItems = await _unitOfWork.Context.CartItems
            .Include(c => c.Modifiers)
            .Where(c => c.UserId == request.UserId && c.MenuItemId == request.MenuItemId)
            .ToListAsync(ct);

        var reqMods = request.ModifierOptionIds ?? new List<int>();

        // Check if an identical item exists (matching special instructions and same modifiers)
        var match = userCartItems.FirstOrDefault(c =>
            string.Equals(c.SpecialInstructions ?? string.Empty, request.SpecialInstructions ?? string.Empty, StringComparison.OrdinalIgnoreCase) &&
            c.Modifiers.Count == reqMods.Count &&
            c.Modifiers.All(m => reqMods.Contains(m.ModifierOptionId)));

        if (match != null)
        {
            if (match.Quantity + request.Quantity > 50)
                throw new BusinessException("Tổng số lượng cho một món trong giỏ hàng không được vượt quá 50.");

            match.UpdateQuantity(match.Quantity + request.Quantity);
        }
        else
        {
            var cartItem = new CartItem(request.UserId, request.MenuItemId, request.Quantity, request.SpecialInstructions);

            if (reqMods.Any())
            {
                var allOptions = menuItem.ModifierGroups.SelectMany(g => g.ModifierGroup.Options).ToList();
                foreach (var optId in reqMods)
                {
                    var opt = allOptions.FirstOrDefault(o => o.Id == optId);
                    if (opt != null)
                    {
                        cartItem.AddModifier(opt, 1);
                    }
                }
            }

            _unitOfWork.Context.CartItems.Add(cartItem);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return await _cartQueryRepo.GetUserCartAsync(request.UserId, ct);
    }

    public async Task<CartViewDto> UpdateQuantityAsync(int userId, int cartItemId, int quantity, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");

        if (quantity <= 0)
            throw new BusinessException("Số lượng món ăn trong giỏ hàng phải lớn hơn 0.");

        if (quantity > 50)
            throw new BusinessException("Số lượng món trong giỏ hàng không được vượt quá 50.");

        var item = await _unitOfWork.Context.CartItems.FirstOrDefaultAsync(c => c.Id == cartItemId, ct);
        if (item == null)
            throw new NotFoundException($"Không tìm thấy món trong giỏ hàng #{cartItemId}.");

        if (item.UserId != userId)
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa giỏ hàng của người dùng khác.");

        item.UpdateQuantity(quantity);
        await _unitOfWork.SaveChangesAsync(ct);

        return await _cartQueryRepo.GetUserCartAsync(userId, ct);
    }

    public async Task<CartViewDto> RemoveItemAsync(int userId, int cartItemId, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");

        var item = await _unitOfWork.Context.CartItems.FirstOrDefaultAsync(c => c.Id == cartItemId, ct);
        if (item == null)
            throw new NotFoundException($"Không tìm thấy món trong giỏ hàng #{cartItemId}.");

        if (item.UserId != userId)
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa giỏ hàng của người dùng khác.");

        _unitOfWork.Context.CartItems.Remove(item);
        await _unitOfWork.SaveChangesAsync(ct);

        return await _cartQueryRepo.GetUserCartAsync(userId, ct);
    }

    public async Task<bool> ClearCartAsync(int userId, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");

        var items = await _unitOfWork.Context.CartItems.Where(c => c.UserId == userId).ToListAsync(ct);
        if (items.Any())
        {
            _unitOfWork.Context.CartItems.RemoveRange(items);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        return true;
    }
}
