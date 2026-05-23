using System.Text;
using Application.Interfaces.Storage;
using Domain.Exceptions;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Services.Storage;

public class LocalFileStorageService : IFileStorageService
{
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB
    private readonly IConfiguration _configuration;
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    public LocalFileStorageService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task<string> SaveFileAsync(Stream fileStream, string originalFileName, string subFolder, CancellationToken ct = default)
    {
        if (fileStream == null || fileStream.Length == 0)
        {
            throw new BusinessException("Tệp tải lên không hợp lệ hoặc rỗng.");
        }

        if (fileStream.Length > MaxFileSizeBytes)
        {
            throw new BusinessException("Kích thước tệp tải lên không được vượt quá 5MB.");
        }

        var ext = Path.GetExtension(originalFileName).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
        {
            throw new BusinessException($"Định dạng tệp '{ext}' không được hỗ trợ. Chỉ chấp nhận các định dạng ảnh: .jpg, .jpeg, .png, .webp.");
        }

        // Inspect header bytes to block disguised executable / script payloads
        if (fileStream.CanSeek)
        {
            fileStream.Position = 0;
            var headerBuffer = new byte[Math.Min(64, (int)fileStream.Length)];
            var bytesRead = await fileStream.ReadAsync(headerBuffer.AsMemory(0, headerBuffer.Length), ct);
            fileStream.Position = 0;

            if (IsDisguisedExecutableOrScript(headerBuffer.AsSpan(0, bytesRead)))
            {
                throw new BusinessException("Nội dung tệp chứa mã thực thi hoặc script không an toàn.");
            }
        }

        var safeSubFolder = SanitizeSubFolder(subFolder);
        var webRoot = ResolveWebRoot();
        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads"));
        var targetDir = Path.GetFullPath(Path.Combine(uploadsRoot, safeSubFolder));

        if (!targetDir.Equals(uploadsRoot, StringComparison.OrdinalIgnoreCase) &&
            !targetDir.StartsWith(uploadsRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException("Thư mục lưu trữ không hợp lệ.");
        }

        if (!Directory.Exists(targetDir))
        {
            Directory.CreateDirectory(targetDir);
        }

        var uniqueFileName = $"{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(targetDir, uniqueFileName);

        using (var output = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await fileStream.CopyToAsync(output, ct);
        }

        return $"/uploads/{safeSubFolder}/{uniqueFileName}";
    }

    public Task<bool> DeleteFileAsync(string relativePath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return Task.FromResult(false);

        var webRoot = ResolveWebRoot();
        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads"));

        var normalizedRelative = relativePath.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(webRoot, normalizedRelative));

        // Security: Prevent Path Traversal outside the uploads directory
        if (!fullPath.StartsWith(uploadsRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException("Đường dẫn tệp cần xóa không hợp lệ (Path Traversal Blocked).");
        }

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }

    private string ResolveWebRoot()
    {
        var configured = _configuration["Storage:UploadPath"];
        if (string.IsNullOrWhiteSpace(configured))
        {
            return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "wwwroot"));
        }

        return Path.IsPathRooted(configured)
            ? Path.GetFullPath(configured)
            : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configured));
    }

    private static string SanitizeSubFolder(string subFolder)
    {
        if (string.IsNullOrWhiteSpace(subFolder)) return "general";
        var cleaned = new string(subFolder.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());
        return string.IsNullOrWhiteSpace(cleaned) ? "general" : cleaned;
    }

    private static bool IsDisguisedExecutableOrScript(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 2 && header[0] == (byte)'M' && header[1] == (byte)'Z')
        {
            return true; // Windows PE / EXE / DLL
        }

        var textHeader = Encoding.UTF8.GetString(header).TrimStart();
        if (textHeader.StartsWith("<?php", StringComparison.OrdinalIgnoreCase) ||
            textHeader.StartsWith("<script", StringComparison.OrdinalIgnoreCase) ||
            textHeader.StartsWith("<html", StringComparison.OrdinalIgnoreCase) ||
            textHeader.StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase) ||
            textHeader.StartsWith("<svg", StringComparison.OrdinalIgnoreCase) ||
            textHeader.StartsWith("#!/", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }
}
