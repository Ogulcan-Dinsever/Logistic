using Logistic.Application.Commands.ReceiptCommands;
using Logistic.Application.Handlers.ReceiptHandlers.CommandHandlers;
using Logistic.Application.Services;
using Logistic.Application.Mapping;
using Logistic.Domain.Aggregate;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Xunit;

namespace Logistic.Tests;

public class ReceiptValidationTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task NonPositiveQuantityIsRejectedBeforeDatabaseAccess(int quantity)
    {
        var result = await Handler().Handle(Command(quantity), CancellationToken.None);
        Assert.Equal(400, result.StatusCode);
    }

    [Fact]
    public async Task MissingIdempotencyKeyIsRejected()
    {
        var command = Command();
        command.IdempotencyKey = "";
        Assert.Equal(400, (await Handler().Handle(command, CancellationToken.None)).StatusCode);
    }

    [Fact]
    public async Task InvalidIdentityIsUnauthorized()
    {
        var command = Command();
        command.CreatedBy = "";
        Assert.Equal(401, (await Handler().Handle(command, CancellationToken.None)).StatusCode);
    }

    [Fact]
    public async Task InvalidProductIdentifierIsRejected()
    {
        var command = Command();
        command.ProductId = "barcode-is-not-product-id";
        Assert.Equal(400, (await Handler().Handle(command, CancellationToken.None)).StatusCode);
    }

    private static CreateReceiptCommand Command(int quantity = 10) => new()
    {
        CreatedBy = ObjectId.GenerateNewId().ToString(), ProductId = ObjectId.GenerateNewId().ToString(),
        Supplier = "Tedarikçi", Quantity = quantity, IdempotencyKey = Guid.NewGuid().ToString()
    };

    private static CreateReceiptHandler Handler()
    {
        var context = new MongoDbContext(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"
        }).Build());

        return new CreateReceiptHandler(
            new Repository<Receipt>(context),
            new Repository<Product>(context),
            new Repository<Shelf>(context),
            new Repository<Stock>(context),
            new Repository<StockMovement>(context),
            new Repository<User>(context),
            ObjectMapper.Mapper,
            NullLogger<CreateReceiptHandler>.Instance);
    }
}
