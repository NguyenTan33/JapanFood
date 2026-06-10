using API.Security;
using Application.DTOs.Content;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Domain.Constants;
using Domain.Entities.Content;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
[Route("api/restaurant-info")]
public class RestaurantInfoController : BaseApiController
{
    private readonly IContentQueryRepository _contentQueryRepo;
    private readonly IUnitOfWork _unitOfWork;

    public RestaurantInfoController(IContentQueryRepository contentQueryRepo, IUnitOfWork unitOfWork)
    {
        _contentQueryRepo = contentQueryRepo;
        _unitOfWork = unitOfWork;
    }

    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(RestaurantInfoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRestaurantInfo(CancellationToken ct = default)
    {
        var info = await _contentQueryRepo.GetRestaurantInfoAsync(ct);
        if (info == null)
        {
            return NotFound(new { message = "Chưa cấu hình thông tin nhà hàng." });
        }

        return Ok(info);
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateRestaurantInfo([FromBody] UpdateRestaurantInfoRequest request, CancellationToken ct)
    {
        var setting = await _unitOfWork.Context.RestaurantSettings.FirstOrDefaultAsync(s => s.SettingKey == "DEFAULT", ct);
        if (setting == null)
        {
            setting = new RestaurantSetting(
                "DEFAULT",
                request.BrandName,
                request.Hotline,
                request.Email,
                request.BankName,
                request.BankId,
                request.AccountNumber,
                request.AccountName,
                request.JapaneseName,
                request.Slogan,
                request.FacebookUrl,
                request.InstagramUrl,
                request.BankBranch,
                request.DefaultQrTemplate ?? "compact2");
            _unitOfWork.Context.RestaurantSettings.Add(setting);
        }
        else
        {
            setting.UpdateDetails(
                request.BrandName ?? setting.BrandName,
                request.Hotline ?? setting.Hotline,
                request.Email ?? setting.Email,
                request.BankName ?? setting.BankName,
                request.BankId ?? setting.BankId,
                request.AccountNumber ?? setting.AccountNumber,
                request.AccountName ?? setting.AccountName,
                request.JapaneseName ?? setting.JapaneseName,
                request.Slogan ?? setting.Slogan,
                request.FacebookUrl ?? setting.FacebookUrl,
                request.InstagramUrl ?? setting.InstagramUrl,
                request.BankBranch ?? setting.BankBranch,
                request.DefaultQrTemplate ?? setting.DefaultQrTemplate);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { message = "Cập nhật thông tin nhà hàng thành công." });
    }
}

public class UpdateRestaurantInfoRequest
{
    public string BrandName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Slogan { get; set; }
    public string Hotline { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FacebookUrl { get; set; }
    public string? InstagramUrl { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string BankId { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string? BankBranch { get; set; }
    public string? DefaultQrTemplate { get; set; }
}
