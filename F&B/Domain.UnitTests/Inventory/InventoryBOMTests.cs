using Domain.Entities.Inventory;
using Domain.Exceptions;

namespace Domain.UnitTests.Inventory;

public class InventoryBOMTests
{
    #region UnitOfMeasure Tests

    [Fact]
    public void UnitOfMeasure_WithValidData_ShouldInitialize()
    {
        var uomKg = new UnitOfMeasure("KG", "Kilogram", baseUomId: null, conversionFactor: 1.0m);
        Assert.Equal("KG", uomKg.Code);
        Assert.Equal("Kilogram", uomKg.Name);
        Assert.Null(uomKg.BaseUomId);
        Assert.Equal(1.0m, uomKg.ConversionFactor);
        Assert.True(uomKg.IsActive);

        var uomGram = new UnitOfMeasure("G", "Gram", baseUomId: 1, conversionFactor: 0.001m);
        Assert.Equal("G", uomGram.Code);
        Assert.Equal(1, uomGram.BaseUomId);
        Assert.Equal(0.001m, uomGram.ConversionFactor);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-0.5)]
    public void UnitOfMeasure_WithZeroOrNegativeConversionFactor_ShouldThrowBusinessException(decimal factor)
    {
        var ex = Assert.Throws<BusinessException>(() => new UnitOfMeasure("KG", "Kilogram", null, factor));
        Assert.Contains("Hệ số quy đổi phải lớn hơn 0", ex.Message);
    }

    [Theory]
    [InlineData("", "Kilogram")]
    [InlineData("KG", "")]
    public void UnitOfMeasure_WithEmptyCodeOrName_ShouldThrowBusinessException(string code, string name)
    {
        Assert.Throws<BusinessException>(() => new UnitOfMeasure(code, name));
    }

    #endregion

    #region InventoryItem & Stock Invariants Tests

    [Fact]
    public void InventoryItem_WithValidData_ShouldInitializeCorrectly()
    {
        var item = new InventoryItem(
            sku: "ING-PORK-BELLY",
            name: "Thịt ba chỉ heo tươi",
            category: "Meat",
            primaryUomId: 1,
            minimumStock: 10.0m,
            unitCost: 120_000m,
            storageLocation: "Tủ đông A1");

        Assert.Equal("ING-PORK-BELLY", item.Sku);
        Assert.Equal("Thịt ba chỉ heo tươi", item.Name);
        Assert.Equal("Meat", item.Category);
        Assert.Equal(1, item.PrimaryUomId);
        Assert.Equal(0, item.CurrentStock);
        Assert.Equal(10.0m, item.MinimumStock);
        Assert.Equal(120_000m, item.UnitCost);
        Assert.Equal("Tủ đông A1", item.StorageLocation);
        Assert.True(item.IsActive);
    }

    [Fact]
    public void AddStock_ShouldIncreaseStockAndRecalculateWeightedAverageCost()
    {
        // Initial state: 10 kg @ 50,000 VND
        var item = new InventoryItem("ING-FLOUR", "Bột mì làm mì ramen", "DryGoods", 1, 5, 50_000m);
        item.AddStock(quantity: 10m, unitCost: 50_000m, reason: "Nhập đợt đầu");

        Assert.Equal(10m, item.CurrentStock);
        Assert.Equal(50_000m, item.UnitCost);

        // Second batch: 10 kg @ 70,000 VND
        // Weighted average: (10 * 50,000 + 10 * 70,000) / 20 = 1,200,000 / 20 = 60,000 VND
        item.AddStock(quantity: 10m, unitCost: 70_000m, reason: "Nhập đợt hai giá biến động");

        Assert.Equal(20m, item.CurrentStock);
        Assert.Equal(60_000m, item.UnitCost);
    }

    [Theory]
    [InlineData(0, 50_000)]
    [InlineData(-5, 50_000)]
    [InlineData(10, -100)]
    public void AddStock_WithInvalidQuantityOrCost_ShouldThrowBusinessException(decimal qty, decimal cost)
    {
        var item = new InventoryItem("ING-FLOUR", "Bột mì", "DryGoods", 1);
        Assert.Throws<BusinessException>(() => item.AddStock(qty, cost, "Nhập kho"));
    }

    [Fact]
    public void DeductStock_WhenSufficient_ShouldDecreaseCurrentStock()
    {
        var item = new InventoryItem("ING-NOODLE", "Mì Ramen tươi", "Noodles", 1);
        item.AddStock(20m, 30_000m, "Nhập kho");

        item.DeductStock(5m, "Xuất bếp chế biến 10 tô ramen");

        Assert.Equal(15m, item.CurrentStock);
    }

    [Fact]
    public void DeductStock_WhenInsufficient_ShouldThrowBusinessException()
    {
        var item = new InventoryItem("ING-NOODLE", "Mì Ramen tươi", "Noodles", 1);
        item.AddStock(5m, 30_000m, "Nhập kho");

        var ex = Assert.Throws<BusinessException>(() => item.DeductStock(10m, "Xuất quá lượng tồn"));
        Assert.Contains("Tồn kho không đủ", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void DeductStock_WithZeroOrNegativeQuantity_ShouldThrowBusinessException(decimal qty)
    {
        var item = new InventoryItem("ING-NOODLE", "Mì Ramen tươi", "Noodles", 1);
        item.AddStock(10m, 30_000m, "Nhập");

        var ex = Assert.Throws<BusinessException>(() => item.DeductStock(qty, "Xuất"));
        Assert.Contains("Số lượng xuất kho phải lớn hơn 0", ex.Message);
    }

    [Fact]
    public void AdjustStock_ValidAndNegativeValidation()
    {
        var item = new InventoryItem("ING-EGG", "Trứng gà tươi", "Fresh", 1);
        item.AddStock(50m, 3_000m, "Nhập");

        // Valid adjustment
        item.AdjustStock(48m, "Hao hụt vỡ 2 quả trong ca");
        Assert.Equal(48m, item.CurrentStock);

        // Negative adjustment throws
        var ex = Assert.Throws<BusinessException>(() => item.AdjustStock(-5m, "Sai"));
        Assert.Contains("Tồn kho sau điều chỉnh không được âm", ex.Message);
    }

    #endregion

    #region RecipeBOM Tests

    [Fact]
    public void RecipeBOM_WithValidData_ShouldCalculateGrossRequirementAccurately()
    {
        // 200g pork with 10% trim wastage -> Gross: 200 * (1 + 0.10) = 220g
        var bom = new RecipeBOM(
            menuItemId: 1,
            inventoryItemId: 10,
            quantityRequired: 200m,
            uomId: 2,
            wastagePercentage: 10m,
            preparationNotes: "Cắt lát dày 5mm");

        Assert.Equal(1, bom.MenuItemId);
        Assert.Equal(10, bom.InventoryItemId);
        Assert.Equal(200m, bom.QuantityRequired);
        Assert.Equal(2, bom.UomId);
        Assert.Equal(10m, bom.WastagePercentage);
        Assert.Equal(220m, bom.CalculateGrossRequirement());
    }

    [Fact]
    public void RecipeBOM_WithZeroWastage_GrossRequirementEqualsNetRequirement()
    {
        var bom = new RecipeBOM(1, 10, 150m, 2, wastagePercentage: 0m);
        Assert.Equal(150m, bom.CalculateGrossRequirement());
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public void RecipeBOM_WithInvalidWastagePercentage_ShouldThrowBusinessException(decimal wastage)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new RecipeBOM(1, 10, 100m, 2, wastagePercentage: wastage));
        Assert.Contains("Tỷ lệ hao hụt phải từ 0% đến 100%", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public void RecipeBOM_WithZeroOrNegativeQuantity_ShouldThrowBusinessException(decimal qty)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new RecipeBOM(1, 10, qty, 2));
        Assert.Contains("Định lượng nguyên liệu phải lớn hơn 0", ex.Message);
    }

    #endregion

    #region PurchaseOrder Lifecycle Tests

    [Fact]
    public void PurchaseOrder_FullLifecycle_Draft_To_Approved_To_Received()
    {
        var po = new PurchaseOrder(
            poNumber: "PO-202611-001",
            supplierId: 1,
            createdByUserId: 10,
            expectedDeliveryDate: DateTime.UtcNow.AddDays(2),
            notes: "Giao hàng trước 9h sáng");

        Assert.Equal(PurchaseOrderStatus.Draft, po.Status);
        Assert.Equal(0, po.TotalAmount);

        // Add 2 items in Draft
        var item1 = po.AddItem(inventoryItemId: 101, quantityOrdered: 50m, unitPrice: 20_000m); // 1,000,000
        var item2 = po.AddItem(inventoryItemId: 102, quantityOrdered: 10m, unitPrice: 150_000m); // 1,500,000

        Assert.Equal(2, po.Items.Count);
        Assert.Equal(2_500_000m, po.TotalAmount);

        // Approve
        po.Approve(managerUserId: 2);
        Assert.Equal(PurchaseOrderStatus.Approved, po.Status);
        Assert.Equal(2, po.ApprovedByUserId);

        // Receive
        item1.RecordReceipt(50m);
        item2.RecordReceipt(10m);
        po.Receive();
        Assert.Equal(PurchaseOrderStatus.Received, po.Status);
        Assert.NotNull(po.ReceivedDate);
    }

    [Fact]
    public void PurchaseOrder_AddItem_WhenNotDraft_ShouldThrowBusinessException()
    {
        var po = new PurchaseOrder("PO-001", 1, 10);
        po.AddItem(1, 10m, 50_000m);
        po.Approve(managerUserId: 2);

        var ex = Assert.Throws<BusinessException>(() => po.AddItem(2, 5m, 30_000m));
        Assert.Contains("Chỉ đơn hàng Nháp (Draft) mới có thể chỉnh sửa", ex.Message);
    }

    [Fact]
    public void PurchaseOrder_Approve_WhenEmpty_ShouldThrowBusinessException()
    {
        var po = new PurchaseOrder("PO-001", 1, 10);
        var ex = Assert.Throws<BusinessException>(() => po.Approve(managerUserId: 2));
        Assert.Contains("Không thể phê duyệt đơn mua hàng không có mặt hàng nào", ex.Message);
    }

    [Fact]
    public void PurchaseOrder_Receive_WhenNotApproved_ShouldThrowBusinessException()
    {
        var po = new PurchaseOrder("PO-001", 1, 10);
        po.AddItem(1, 10m, 50_000m);

        // Still in Draft
        var ex = Assert.Throws<BusinessException>(() => po.Receive());
        Assert.Contains("Đơn hàng phải được Phê duyệt (Approved) trước khi nhận hàng", ex.Message);
    }

    [Fact]
    public void PurchaseOrder_Cancel_WhenReceived_ShouldThrowBusinessException()
    {
        var po = new PurchaseOrder("PO-001", 1, 10);
        po.AddItem(1, 10m, 50_000m);
        po.Approve(managerUserId: 2);
        po.Receive();

        var ex = Assert.Throws<BusinessException>(() => po.Cancel("Hủy đơn"));
        Assert.Contains("Không thể hủy đơn mua hàng đã được nhập kho hoàn tất", ex.Message);
    }

    #endregion

    #region InventoryAudit Tests

    [Fact]
    public void InventoryAudit_FullLifecycle_Draft_To_Submitted_To_Approved()
    {
        var audit = new InventoryAudit(
            auditNumber: "AUD-202611-01",
            auditorUserId: 5,
            notes: "Kiểm kê kho lạnh cuối tuần");

        Assert.Equal(AuditStatus.Draft, audit.Status);

        // Record item with exact count (no discrepancy)
        var item1 = audit.RecordItem(inventoryItemId: 1, systemExpectedQuantity: 20m, actualQuantity: 20m, reason: null);
        Assert.Equal(0, item1.DiscrepancyQuantity);

        // Record item with discrepancy (shortage -2) with mandatory reason
        var item2 = audit.RecordItem(inventoryItemId: 2, systemExpectedQuantity: 15m, actualQuantity: 13m, reason: "Hao hụt rã đông");
        Assert.Equal(-2m, item2.DiscrepancyQuantity);

        // Submit
        audit.Submit();
        Assert.Equal(AuditStatus.Submitted, audit.Status);

        // Approve
        audit.Approve(managerUserId: 1);
        Assert.Equal(AuditStatus.Approved, audit.Status);
        Assert.Equal(1, audit.ApprovedByUserId);
        Assert.NotNull(audit.ApprovedAt);
    }

    [Fact]
    public void InventoryAudit_RecordItem_DiscrepancyWithoutReason_ShouldThrowBusinessException()
    {
        var audit = new InventoryAudit("AUD-01", 5);

        // Discrepancy +5 without reason must throw
        var ex = Assert.Throws<BusinessException>(() =>
            audit.RecordItem(inventoryItemId: 1, systemExpectedQuantity: 10m, actualQuantity: 15m, reason: null));
        Assert.Contains("Lý do chênh lệch là bắt buộc", ex.Message);
    }

    [Fact]
    public void InventoryAudit_Submit_WhenEmpty_ShouldThrowBusinessException()
    {
        var audit = new InventoryAudit("AUD-01", 5);
        var ex = Assert.Throws<BusinessException>(() => audit.Submit());
        Assert.Contains("Không thể gửi duyệt phiếu kiểm kê không có mặt hàng nào", ex.Message);
    }

    [Fact]
    public void InventoryAudit_Approve_WhenNotSubmitted_ShouldThrowBusinessException()
    {
        var audit = new InventoryAudit("AUD-01", 5);
        audit.RecordItem(1, 10m, 10m, null);

        // Still Draft, not Submitted
        var ex = Assert.Throws<BusinessException>(() => audit.Approve(managerUserId: 1));
        Assert.Contains("Phiếu kiểm kê phải được Gửi duyệt (Submitted) trước", ex.Message);
    }

    [Fact]
    public void InventoryAudit_Cancel_WhenApproved_ShouldThrowBusinessException()
    {
        var audit = new InventoryAudit("AUD-01", 5);
        audit.RecordItem(1, 10m, 10m, null);
        audit.Submit();
        audit.Approve(managerUserId: 1);

        var ex = Assert.Throws<BusinessException>(() => audit.Cancel("Hủy phiếu"));
        Assert.Contains("Không thể hủy phiếu kiểm kê đã được phê duyệt", ex.Message);
    }

    #endregion
}
