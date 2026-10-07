using Logistic.Application.Commands.StockCommands;
using Logistic.Application.Handlers.StockHandlers.CommandHandlers;
using Logistic.Application.Mapping;
using Logistic.Application.Services;
using Logistic.Domain.Aggregate;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Xunit;

namespace Logistic.Tests;

public class PutawayValidationTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task NonPositiveQuantityIsRejectedBeforeDatabaseAccess(int quantity)
    {
        var command = Command();
        command.Quantity = quantity;

        var result = await Handler().Handle(command, CancellationToken.None);

        Assert.Equal(400, result.StatusCode);
    }

    [Fact]
    public async Task InvalidIdentityIsUnauthorizedBeforeDatabaseAccess()
    {
        var command = Command();
        command.CreatedBy = "";

        var result = await Handler().Handle(command, CancellationToken.None);

        Assert.Equal(401, result.StatusCode);
    }

    [Theory]
    [InlineData("barcode")]
    [InlineData("source")]
    [InlineData("target")]
    [InlineData("key")]
    public async Task MissingOrInvalidInputIsRejectedBeforeDatabaseAccess(string field)
    {
        var command = Command();
        if (field == "barcode") command.ProductBarcode = " ";
        if (field == "source") command.SourceShelfId = "invalid-id";
        if (field == "target") command.TargetShelfCode = " ";
        if (field == "key") command.IdempotencyKey = "";

        var result = await Handler().Handle(command, CancellationToken.None);

        Assert.Equal(400, result.StatusCode);
    }

    private static PutawayStockCommand Command()
    {
        return new PutawayStockCommand
        {
            CreatedBy = ObjectId.GenerateNewId().ToString(),
            ProductBarcode = "8690000000001",
            SourceShelfId = ObjectId.GenerateNewId().ToString(),
            TargetShelfCode = "A-01",
            Quantity = 3,
            IdempotencyKey = Guid.NewGuid().ToString()
        };
    }

    private static PutawayStockHandler Handler()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"
            }).Build();
        var context = new MongoDbContext(configuration);

        return new PutawayStockHandler(
            new Repository<Product>(context),
            new Repository<Shelf>(context),
            new Repository<Stock>(context),
            new Repository<StockMovement>(context),
            new Repository<User>(context),
            ObjectMapper.Mapper,
            NullLogger<PutawayStockHandler>.Instance);
    }
}
