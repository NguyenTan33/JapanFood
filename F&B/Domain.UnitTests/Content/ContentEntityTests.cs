using Domain.Entities.Content;
using Domain.Entities.Menu;
using Domain.Entities.TableManagement;
using Domain.Exceptions;

namespace Domain.UnitTests.Content;

public class ContentEntityTests
{
    [Fact]
    public void Branch_ConstructorAndUpdate_ShouldEnforceInvariants()
    {
        var branch = new Branch(
            "BRANCH-D1",
            "Chi nhánh 1",
            "15A/2 Lê Thánh Tôn",
            "Quận 1",
            "TP. Hồ Chí Minh",
            "028 3822 8899",
            "レタントン本店",
            isMainBranch: true,
            displayOrder: 1);

        Assert.Equal("branch-d1", branch.Code);
        Assert.True(branch.IsMainBranch);
        Assert.True(branch.IsActive);

        branch.Deactivate();
        Assert.False(branch.IsActive);
        branch.Activate();
        Assert.True(branch.IsActive);

        Assert.Throws<BusinessException>(() =>
            new Branch("", "Name", "Address", "D1", "City", "0123"));
        Assert.Throws<BusinessException>(() =>
            new Branch("code", "", "Address", "D1", "City", "0123"));
        Assert.Throws<BusinessException>(() =>
            new Branch("code", "Name", "", "D1", "City", "0123"));
        Assert.Throws<BusinessException>(() =>
            new Branch("code", "Name", "Address", "D1", "City", ""));
    }

    [Fact]
    public void BlogPost_ConstructorAndPublishToggle_ShouldEnforceInvariants()
    {
        var post = new BlogPost(
            "Sushi-Guide",
            "Nghệ thuật Sushi",
            "Culture",
            "Tóm tắt",
            "Nội dung chi tiết",
            "Kenji Takahashi",
            DateTime.UtcNow,
            readTimeMinutes: 6);

        Assert.Equal("sushi-guide", post.Slug);
        Assert.True(post.IsPublished);

        post.Unpublish();
        Assert.False(post.IsPublished);
        post.Publish();
        Assert.True(post.IsPublished);

        Assert.Throws<BusinessException>(() =>
            new BlogPost("", "Title", "Cat", "Excerpt", "Content", "Author", DateTime.UtcNow));
        Assert.Throws<BusinessException>(() =>
            new BlogPost("slug", "Title", "Cat", "Excerpt", "", "Author", DateTime.UtcNow));
        Assert.Throws<BusinessException>(() =>
            new BlogPost("slug", "Title", "Cat", "Excerpt", "Content", "Author", DateTime.UtcNow, readTimeMinutes: 0));
    }

    [Fact]
    public void RestaurantSetting_ConstructorAndUpdate_ShouldEnforceInvariants()
    {
        var setting = new RestaurantSetting(
            "default",
            "TORI SAKURA",
            "1900 8899",
            "contact@torisakura.vn",
            "MB Bank",
            "mb",
            "0903123456888",
            "TORI SAKURA CO LTD");

        Assert.Equal("DEFAULT", setting.SettingKey);
        Assert.Equal("MB", setting.BankId);
        Assert.Equal("compact2", setting.DefaultQrTemplate);

        setting.UpdateDetails(
            "TORI SAKURA NEW",
            "1900 9999",
            "hi@torisakura.vn",
            "Vietcombank",
            "vcb",
            "123456",
            "TORI SAKURA",
            "桜鳥",
            "Slogan",
            null,
            null,
            null,
            "compact");

        Assert.Equal("VCB", setting.BankId);
        Assert.Equal("compact", setting.DefaultQrTemplate);

        Assert.Throws<BusinessException>(() =>
            new RestaurantSetting("DEFAULT", "", "1900", "a@b.c", "MB", "MB", "123", "ACC"));
        Assert.Throws<BusinessException>(() =>
            new RestaurantSetting("DEFAULT", "Brand", "1900", "a@b.c", "MB", "", "123", "ACC"));
    }

    [Fact]
    public void Order_SetDeliveryAndPayment_Cod50Deposit_ShouldComputeDepositAndRemaining()
    {
        var cat = new Category("RAMEN", "Ramen");
        var dish = new MenuItem(cat.Id, "RAMEN-01", "Tonkotsu", 100000m);
        var order = new Order(OrderType.Delivery, null, userId: 1, guestCount: 2);
        order.AddItem(dish, 2); // SubTotal = 200,000; Tax = 16,000; Total = 216,000

        order.SetDeliveryAndPayment("15 Lê Thánh Tôn", "Minh", "0901234567", OrderPaymentMethod.Cod50Deposit, 15000m);

        // SubTotal 200,000 + Tax 16,000 + Delivery 15,000 = 231,000
        Assert.Equal(231000m, order.TotalAmount);
        Assert.Equal(115500m, order.DepositAmount);
        Assert.Equal(115500m, order.RemainingCodAmount);
        Assert.Equal(OrderPaymentMethod.Cod50Deposit, order.PaymentMethod);
    }

    [Fact]
    public void TableArea_UpdateRichDetails_ShouldValidateGuestBounds()
    {
        var area = new TableArea("TATAMI", "Phòng Tatami");
        area.UpdateRichDetails("Phòng Tatami", "畳個室", "Mô tả", "https://img", "[\"F1\"]", "4-8", 4, 8, true, 50000m, 2);

        Assert.Equal("畳個室", area.JapaneseName);
        Assert.Equal(4, area.MinGuests);
        Assert.Equal(8, area.MaxGuests);
        Assert.True(area.RequiresDeposit);
        Assert.Equal(50000m, area.DepositPerGuest);

        Assert.Throws<BusinessException>(() =>
            area.UpdateRichDetails("Phòng Tatami", null, null, null, null, null, 0, 8, false, null, 1));
        Assert.Throws<BusinessException>(() =>
            area.UpdateRichDetails("Phòng Tatami", null, null, null, null, null, 8, 4, false, null, 1));
    }
}
