using Application.Interfaces;
using Application.Interfaces.Communication;
using Application.Interfaces.Payment;
using Application.Interfaces.Storage;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Storage;

namespace APIAuth.Services.Common;

public class TestDbContextTransaction : IDbContextTransaction
{
    public Guid TransactionId { get; } = Guid.NewGuid();

    public bool IsCommitted { get; private set; }
    public bool IsRolledBack { get; private set; }
    public bool IsDisposed { get; private set; }

    public void Commit()
    {
        IsCommitted = true;
    }

    public Task CommitAsync(CancellationToken cancellationToken = default)
    {
        IsCommitted = true;
        return Task.CompletedTask;
    }

    public void Rollback()
    {
        IsRolledBack = true;
    }

    public Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        IsRolledBack = true;
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        IsDisposed = true;
    }

    public ValueTask DisposeAsync()
    {
        IsDisposed = true;
        return ValueTask.CompletedTask;
    }
}

public class TestUnitOfWork : IUnitOfWork
{
    private readonly JapanFoodDbContext _context;
    private TestDbContextTransaction? _currentTransaction;

    public bool HasCommitted { get; private set; }
    public bool HasRolledBack { get; private set; }
    public int BeginTransactionCount { get; private set; }
    public int CommitTransactionCount { get; private set; }
    public int RollbackTransactionCount { get; private set; }
    public TestDbContextTransaction? LastTransaction => _currentTransaction;

    public TestUnitOfWork(JapanFoodDbContext context)
    {
        _context = context;
    }

    public IJapanFoodDbContext Context => _context;

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }

    public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        BeginTransactionCount++;
        _currentTransaction = new TestDbContextTransaction();
        return Task.FromResult<IDbContextTransaction>(_currentTransaction);
    }

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
        HasCommitted = true;
        CommitTransactionCount++;
        if (_currentTransaction != null)
        {
            await _currentTransaction.CommitAsync(cancellationToken);
            await _currentTransaction.DisposeAsync();
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        HasRolledBack = true;
        RollbackTransactionCount++;
        if (_currentTransaction != null)
        {
            await _currentTransaction.RollbackAsync(cancellationToken);
            await _currentTransaction.DisposeAsync();
        }
    }

    public void Dispose()
    {
        _currentTransaction?.Dispose();
        _context.Dispose();
        GC.SuppressFinalize(this);
    }
}

public class TestEmailService : IEmailService
{
    public List<(string ToEmail, string Subject, string HtmlContent)> SentEmails { get; } = new();
    public bool ShouldThrow { get; set; }

    public Task SendEmailAsync(string toEmail, string subject, string htmlContent, CancellationToken ct = default)
    {
        if (ShouldThrow)
        {
            throw new InvalidOperationException("Simulated SMTP server failure.");
        }

        SentEmails.Add((toEmail, subject, htmlContent));
        return Task.CompletedTask;
    }
}

public class TestVnPayService : IVnPayService
{
    public bool ValidSignature { get; set; } = true;
    public string GeneratedPaymentUrlPrefix { get; set; } = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

    public string CreatePaymentUrl(string transactionNumber, decimal amount, string orderInfo, string returnUrl, string ipAddress)
    {
        return $"{GeneratedPaymentUrlPrefix}?vnp_TxnRef={transactionNumber}&vnp_Amount={(long)(amount * 100)}&vnp_OrderInfo={Uri.EscapeDataString(orderInfo)}";
    }

    public bool ValidateSignature(IDictionary<string, string> queryParameters, string secureHash)
    {
        return ValidSignature;
    }
}

public class TestMoMoService : IMoMoService
{
    public bool ValidSignature { get; set; } = true;

    public string CreateSignature(string rawData)
    {
        return $"momo_signature_{Math.Abs(rawData.GetHashCode()):X8}";
    }

    public bool ValidateSignature(string rawData, string signature)
    {
        return ValidSignature;
    }
}

public class TestFileStorageService : IFileStorageService
{
    public List<(string FileName, string SubFolder, byte[] Content)> SavedFiles { get; } = new();
    public List<string> DeletedFiles { get; } = new();

    public async Task<string> SaveFileAsync(Stream fileStream, string originalFileName, string subFolder, CancellationToken ct = default)
    {
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        SavedFiles.Add((originalFileName, subFolder, ms.ToArray()));
        return $"/uploads/{subFolder}/{Guid.NewGuid():N}_{originalFileName}";
    }

    public Task<bool> DeleteFileAsync(string relativePath, CancellationToken ct = default)
    {
        DeletedFiles.Add(relativePath);
        return Task.FromResult(true);
    }
}
