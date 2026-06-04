namespace Application.Interfaces.Storage;

public interface IFileStorageService
{
    Task<string> SaveFileAsync(Stream fileStream, string originalFileName, string subFolder, CancellationToken ct = default);
    Task<bool> DeleteFileAsync(string relativePath, CancellationToken ct = default);
}
