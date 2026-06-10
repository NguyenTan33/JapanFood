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
[Route("api/branches")]
public class BranchesController : BaseApiController
{
    private readonly IContentQueryRepository _contentQueryRepo;
    private readonly IUnitOfWork _unitOfWork;

    public BranchesController(IContentQueryRepository contentQueryRepo, IUnitOfWork unitOfWork)
    {
        _contentQueryRepo = contentQueryRepo;
        _unitOfWork = unitOfWork;
    }

    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(List<BranchDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBranches(CancellationToken ct = default)
    {
        var branches = await _contentQueryRepo.GetActiveBranchesAsync(ct);
        return Ok(branches);
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateBranch([FromBody] CreateBranchRequest request, CancellationToken ct)
    {
        var code = !string.IsNullOrWhiteSpace(request.Code)
            ? request.Code.Trim().ToLowerInvariant()
            : Guid.NewGuid().ToString("N")[..8];

        var exists = await _unitOfWork.Context.Branches.AnyAsync(b => b.Code == code, ct);
        if (exists)
        {
            return Conflict(new { message = $"Chi nhánh với mã '{code}' đã tồn tại." });
        }

        var branch = new Branch(
            code,
            request.Name,
            request.Address,
            request.District,
            request.City,
            request.Phone,
            request.JapaneseName,
            request.Hotline,
            request.Email,
            request.OpeningHoursLunch,
            request.OpeningHoursDinner,
            request.OpeningHoursNote,
            request.ParkingMotorbike,
            request.ParkingCar,
            request.MapEmbedUrl,
            request.MapDirectionsUrl,
            request.ImageUrl,
            request.IsMainBranch,
            request.DisplayOrder);

        _unitOfWork.Context.Branches.Add(branch);
        await _unitOfWork.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, new { message = "Tạo chi nhánh thành công.", id = branch.Id, code = branch.Code });
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateBranch(int id, [FromBody] UpdateBranchRequest request, CancellationToken ct)
    {
        var branch = await _unitOfWork.Context.Branches.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (branch == null)
        {
            return NotFound(new { message = $"Không tìm thấy chi nhánh #{id}." });
        }

        branch.UpdateDetails(
            request.Name ?? branch.Name,
            request.Address ?? branch.Address,
            request.District ?? branch.District,
            request.City ?? branch.City,
            request.Phone ?? branch.Phone,
            request.JapaneseName ?? branch.JapaneseName,
            request.Hotline ?? branch.Hotline,
            request.Email ?? branch.Email,
            request.OpeningHoursLunch ?? branch.OpeningHoursLunch,
            request.OpeningHoursDinner ?? branch.OpeningHoursDinner,
            request.OpeningHoursNote ?? branch.OpeningHoursNote,
            request.ParkingMotorbike ?? branch.ParkingMotorbike,
            request.ParkingCar ?? branch.ParkingCar,
            request.MapEmbedUrl ?? branch.MapEmbedUrl,
            request.MapDirectionsUrl ?? branch.MapDirectionsUrl,
            request.ImageUrl ?? branch.ImageUrl,
            request.IsMainBranch ?? branch.IsMainBranch,
            request.DisplayOrder ?? branch.DisplayOrder,
            request.IsActive ?? branch.IsActive);

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { message = "Cập nhật chi nhánh thành công." });
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteBranch(int id, CancellationToken ct)
    {
        var branch = await _unitOfWork.Context.Branches.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (branch == null)
        {
            return NotFound(new { message = $"Không tìm thấy chi nhánh #{id}." });
        }

        _unitOfWork.Context.Branches.Remove(branch);
        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { message = "Xóa chi nhánh thành công." });
    }
}

public class CreateBranchRequest
{
    public string? Code { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string Address { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Hotline { get; set; }
    public string? Email { get; set; }
    public string? OpeningHoursLunch { get; set; }
    public string? OpeningHoursDinner { get; set; }
    public string? OpeningHoursNote { get; set; }
    public string? ParkingMotorbike { get; set; }
    public string? ParkingCar { get; set; }
    public string? MapEmbedUrl { get; set; }
    public string? MapDirectionsUrl { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsMainBranch { get; set; }
    public int DisplayOrder { get; set; }
}

public class UpdateBranchRequest
{
    public string? Name { get; set; }
    public string? JapaneseName { get; set; }
    public string? Address { get; set; }
    public string? District { get; set; }
    public string? City { get; set; }
    public string? Phone { get; set; }
    public string? Hotline { get; set; }
    public string? Email { get; set; }
    public string? OpeningHoursLunch { get; set; }
    public string? OpeningHoursDinner { get; set; }
    public string? OpeningHoursNote { get; set; }
    public string? ParkingMotorbike { get; set; }
    public string? ParkingCar { get; set; }
    public string? MapEmbedUrl { get; set; }
    public string? MapDirectionsUrl { get; set; }
    public string? ImageUrl { get; set; }
    public bool? IsMainBranch { get; set; }
    public int? DisplayOrder { get; set; }
    public bool? IsActive { get; set; }
}
