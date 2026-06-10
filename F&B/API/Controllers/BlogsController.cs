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
[Route("api/blogs")]
public class BlogsController : BaseApiController
{
    private readonly IContentQueryRepository _contentQueryRepo;
    private readonly IUnitOfWork _unitOfWork;

    public BlogsController(IContentQueryRepository contentQueryRepo, IUnitOfWork unitOfWork)
    {
        _contentQueryRepo = contentQueryRepo;
        _unitOfWork = unitOfWork;
    }

    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(List<BlogPostDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBlogs([FromQuery] string? category = null, CancellationToken ct = default)
    {
        var blogs = await _contentQueryRepo.GetPublishedBlogsAsync(category, ct);
        return Ok(blogs);
    }

    [AllowAnonymous]
    [HttpGet("{slug}")]
    [ProducesResponseType(typeof(BlogPostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBlogBySlug(string slug, CancellationToken ct = default)
    {
        var blog = await _contentQueryRepo.GetBlogBySlugAsync(slug, ct);
        if (blog == null)
        {
            return NotFound(new { message = $"Không tìm thấy bài viết '{slug}'." });
        }

        return Ok(blog);
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateBlog([FromBody] CreateBlogPostRequest request, CancellationToken ct)
    {
        var slug = !string.IsNullOrWhiteSpace(request.Slug)
            ? request.Slug.Trim().ToLowerInvariant()
            : Guid.NewGuid().ToString("N")[..8];

        var exists = await _unitOfWork.Context.BlogPosts.AnyAsync(b => b.Slug == slug, ct);
        if (exists)
        {
            return Conflict(new { message = $"Bài viết với slug '{slug}' đã tồn tại." });
        }

        var blog = new BlogPost(
            slug,
            request.Title,
            request.Category,
            request.Excerpt ?? string.Empty,
            request.Content ?? string.Empty,
            request.AuthorName ?? "Tori Sakura",
            DateTime.UtcNow,
            request.ReadTimeMinutes > 0 ? request.ReadTimeMinutes : 5,
            request.Subtitle,
            request.JapaneseTitle,
            request.CoverImageUrl,
            request.AuthorRole,
            request.AuthorAvatarUrl,
            request.Tags != null ? string.Join(",", request.Tags) : null,
            request.RelatedDishIds != null ? string.Join(",", request.RelatedDishIds) : null,
            true);

        _unitOfWork.Context.BlogPosts.Add(blog);
        await _unitOfWork.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, new { message = "Tạo bài viết thành công.", id = blog.Id, slug = blog.Slug });
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateBlog(int id, [FromBody] UpdateBlogPostRequest request, CancellationToken ct)
    {
        var blog = await _unitOfWork.Context.BlogPosts.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (blog == null)
        {
            return NotFound(new { message = $"Không tìm thấy bài viết #{id}." });
        }

        blog.UpdateDetails(
            request.Title ?? blog.Title,
            request.Category ?? blog.Category,
            request.Excerpt ?? blog.Excerpt,
            request.Content ?? blog.Content,
            request.AuthorName ?? blog.AuthorName,
            blog.PublishedAt,
            request.ReadTimeMinutes > 0 ? request.ReadTimeMinutes : blog.ReadTimeMinutes,
            request.Subtitle ?? blog.Subtitle,
            request.JapaneseTitle ?? blog.JapaneseTitle,
            request.CoverImageUrl ?? blog.CoverImageUrl,
            request.AuthorRole ?? blog.AuthorRole,
            request.AuthorAvatarUrl ?? blog.AuthorAvatarUrl,
            request.Tags != null ? string.Join(",", request.Tags) : blog.Tags,
            request.RelatedDishIds != null ? string.Join(",", request.RelatedDishIds) : blog.RelatedDishIds,
            request.IsPublished ?? blog.IsPublished);

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { message = "Cập nhật bài viết thành công." });
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteBlog(int id, CancellationToken ct)
    {
        var blog = await _unitOfWork.Context.BlogPosts.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (blog == null)
        {
            return NotFound(new { message = $"Không tìm thấy bài viết #{id}." });
        }

        _unitOfWork.Context.BlogPosts.Remove(blog);
        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(new { message = "Xóa bài viết thành công." });
    }
}

public class CreateBlogPostRequest
{
    public string? Slug { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? JapaneseTitle { get; set; }
    public string Category { get; set; } = "Cuisine Culture";
    public string? Excerpt { get; set; }
    public string? Content { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? AuthorName { get; set; }
    public string? AuthorRole { get; set; }
    public string? AuthorAvatarUrl { get; set; }
    public int ReadTimeMinutes { get; set; } = 5;
    public List<string>? Tags { get; set; }
    public List<int>? RelatedDishIds { get; set; }
}

public class UpdateBlogPostRequest
{
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string? JapaneseTitle { get; set; }
    public string? Category { get; set; }
    public string? Excerpt { get; set; }
    public string? Content { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? AuthorName { get; set; }
    public string? AuthorRole { get; set; }
    public string? AuthorAvatarUrl { get; set; }
    public int ReadTimeMinutes { get; set; }
    public List<string>? Tags { get; set; }
    public List<int>? RelatedDishIds { get; set; }
    public bool? IsPublished { get; set; }
}
