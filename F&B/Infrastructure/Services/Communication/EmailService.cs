using Application.Interfaces.Communication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.Communication;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task SendEmailAsync(string toEmail, string subject, string htmlContent, CancellationToken ct = default)
    {
        // Mock logging for development and staging environments
        _logger.LogInformation(">>> [EMAIL NOTIFICATION] Gửi đến: {To} | Tiêu đề: {Subject}", toEmail, subject);
        return Task.CompletedTask;
    }
}
