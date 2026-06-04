using Application.DTOs.Content;

namespace Application.Interfaces.Repositories;

public interface IContentQueryRepository
{
    Task<List<BranchDto>> GetActiveBranchesAsync(CancellationToken ct = default);
    Task<List<BlogPostDto>> GetPublishedBlogsAsync(string? category = null, CancellationToken ct = default);
    Task<BlogPostDto?> GetBlogBySlugAsync(string slug, CancellationToken ct = default);
    Task<RestaurantInfoDto?> GetRestaurantInfoAsync(CancellationToken ct = default);
}
