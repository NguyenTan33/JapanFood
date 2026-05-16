using Domain.Entities.Payment;
using Domain.Exceptions;

namespace Domain.UnitTests.Payment;

public class PaymentTransactionTests
{
    [Fact]
    public void Constructor_ValidParameters_ShouldInitializeAsPending()
    {
        var txn = new PaymentTransaction(orderId: 100, PaymentGateway.VietQR, 250000m, "192.168.1.1");

        Assert.Equal(100, txn.OrderId);
        Assert.Equal(PaymentGateway.VietQR, txn.Gateway);
        Assert.Equal(250000m, txn.Amount);
        Assert.Equal("192.168.1.1", txn.IpAddress);
        Assert.Equal(PaymentTransactionStatus.Pending, txn.Status);
        Assert.StartsWith("TXN-", txn.TransactionNumber);
    }

    [Fact]
    public void MarkSuccess_ShouldUpdateStatusAndStoreGatewayResponse()
    {
        var txn = new PaymentTransaction(orderId: 100, PaymentGateway.VnPay, 250000m);
        txn.MarkSuccess("VNPAY_12345678", "00", "{\"code\":\"00\",\"status\":\"OK\"}");

        Assert.Equal(PaymentTransactionStatus.Success, txn.Status);
        Assert.Equal("VNPAY_12345678", txn.GatewayTransactionId);
        Assert.Equal("00", txn.GatewayResponseCode);
        Assert.NotNull(txn.PaidAt);
    }

    [Fact]
    public void MarkSuccess_WhenAlreadySuccess_ShouldThrowBusinessException()
    {
        var txn = new PaymentTransaction(orderId: 100, PaymentGateway.MoMo, 100000m);
        txn.MarkSuccess("MOMO_9999");

        var ex = Assert.Throws<BusinessException>(() => txn.MarkSuccess("MOMO_DUPLICATE"));
        Assert.Contains("đã được ghi nhận thành công trước đó", ex.Message);
    }

    [Fact]
    public void MarkRefunded_WhenSuccessful_ShouldUpdateStatusToRefunded()
    {
        var txn = new PaymentTransaction(orderId: 100, PaymentGateway.VietQR, 150000m);
        txn.MarkSuccess("BANK_REF_01");

        txn.MarkRefunded("REFUND_ORDER_100");

        Assert.Equal(PaymentTransactionStatus.Refunded, txn.Status);
        Assert.Equal("REFUND_ORDER_100", txn.RefundReference);
    }

    [Fact]
    public void MarkRefunded_WhenNotSuccess_ShouldThrowBusinessException()
    {
        var txn = new PaymentTransaction(orderId: 100, PaymentGateway.VietQR, 150000m);

        var ex = Assert.Throws<BusinessException>(() => txn.MarkRefunded("REFUND_FAIL"));
        Assert.Contains("Chỉ có thể hoàn tiền cho giao dịch đã thanh toán thành công", ex.Message);
    }
}
