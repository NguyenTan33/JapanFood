using Domain.Exceptions;
using Infrastructure.Services.Storage;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace APIAuth.Services;

public class LocalFileStorageServiceTests : IDisposable
{
    private readonly string _tempRoot;

    public LocalFileStorageServiceTests()
    {
        _tempRoot = Path.Combine(Path.GetTempPath(), $"jf_storage_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempRoot);
    }

    [Fact]
    public async Task SaveAndDeleteFile_UsesConfiguredUploadPathAndBlocksDisguisedPayload()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Storage:UploadPath", _tempRoot }
            })
            .Build();

        var service = new LocalFileStorageService(config);

        using var validImage = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 });
        var relativeUrl = await service.SaveFileAsync(validImage, "cash_proof.jpg", "withdrawals");

        Assert.StartsWith("/uploads/withdrawals/", relativeUrl);
        var physicalPath = Path.Combine(_tempRoot, relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        Assert.True(File.Exists(physicalPath));

        var deleted = await service.DeleteFileAsync(relativeUrl);
        Assert.True(deleted);
        Assert.False(File.Exists(physicalPath));

        // Disguised PE executable blocked
        using var fakeExe = new MemoryStream(new byte[] { (byte)'M', (byte)'Z', 0x90, 0x00 });
        await Assert.ThrowsAsync<BusinessException>(() => service.SaveFileAsync(fakeExe, "malware.png", "withdrawals"));

        // Path traversal on delete blocked
        await Assert.ThrowsAsync<BusinessException>(() => service.DeleteFileAsync("/uploads/../../appsettings.json"));
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot))
        {
            Directory.Delete(_tempRoot, recursive: true);
        }
        GC.SuppressFinalize(this);
    }
}
