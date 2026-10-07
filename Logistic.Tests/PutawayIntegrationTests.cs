using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Logistic.Application.Commands.ReceiptCommands;
using Logistic.Application.Commands.StockCommands;
using Logistic.Application.Handlers.ReceiptHandlers.CommandHandlers;
using Logistic.Application.Handlers.StockHandlers.CommandHandlers;
using Logistic.Application.Mapping;
using Logistic.Application.Services;
using Logistic.Domain.Aggregate;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;

namespace Logistic.Tests;

[Trait("Category", "Integration")]
public class PutawayIntegrationTests : IAsyncLifetime
{
    private readonly string _databaseName = "logistic_putaway_test_" + Guid.NewGuid().ToString("N");
    private string _uri = "";
    private MongoDbContext _context = null!;
    private User _user = null!;
    private Product _product = null!;
    private Shelf _source = null!;
    private Shelf _target = null!;

    public async Task InitializeAsync()
    {
        _uri = Environment.GetEnvironmentVariable("LOGISTIC_TEST_MONGO_URI")
            ?? throw new InvalidOperationException("Integration testleri için LOGISTIC_TEST_MONGO_URI bir MongoDB bağlantısı olmalıdır.");
        _context = Context();
        _user = new User
        {
            Id = Id(),
            Name = "Ogulcan",
            SurName = "Test",
            Email = "putaway@example.invalid",
            Password = "test-only",
            Role = "User",
            CreatedBy = "test",
            ModifiedBy = "test"
        };
        _product = new Product
        {
            Id = Id(),
            Name = "Test ürün",
            Barcode = "8690000000001",
            Sku = "PUTAWAY-01",
            CreatedBy = _user.Id,
            ModifiedBy = _user.Id
        };
        _source = new Shelf
        {
            Id = Id(),
            Code = "KABUL",
            Zone = "Mal Kabul",
            Capacity = 1000,
            IsReceiving = true,
            CreatedBy = _user.Id,
            ModifiedBy = _user.Id
        };
        _target = new Shelf
        {
            Id = Id(),
            Code = "A-01",
            Zone = "Depo",
            Capacity = 100,
            IsReceiving = false,
            CreatedBy = _user.Id,
            ModifiedBy = _user.Id
        };

        await _context.GetCollection<User>().InsertOneAsync(_user);
        await _context.GetCollection<Product>().InsertOneAsync(_product);
        await _context.GetCollection<Shelf>().InsertManyAsync(new[] { _source, _target });
        await _context.GetCollection<Stock>().InsertOneAsync(Stock(_product.Id, _source.Id, 10));
    }

    public async Task DisposeAsync()
    {
        if (_context is not null && _databaseName.StartsWith("logistic_putaway_test_", StringComparison.Ordinal))
            await _context.Database.Client.DropDatabaseAsync(_databaseName);
    }

    [Fact]
    public async Task MoveCreatesDestinationAndMovementWithoutChangingTotalStock()
    {
        var command = Command();
        command.ProductBarcode = " " + _product.Barcode + " ";
        command.TargetShelfCode = " a-01 ";

        var result = await Handler().Handle(command, CancellationToken.None);

        Assert.Equal(201, result.StatusCode);
        Assert.Equal(_user.Id, result.Data.CreatedBy);
        Assert.Equal("Ogulcan Test", result.Data.UserName);
        Assert.Equal("putaway", result.Data.Type);
        Assert.Equal(_source.Id, result.Data.FromShelfId);
        Assert.Equal(_target.Id, result.Data.ToShelfId);
        Assert.Equal(3, result.Data.Quantity);
        var stocks = await Stocks();
        Assert.Equal(2, stocks.Count);
        Assert.Equal(7, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
        Assert.Equal(3, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
        Assert.Equal(10, stocks.Sum(x => x.Quantity));
        var movement = Assert.Single(await Movements());
        Assert.Equal(result.Data.Id, movement.Id);
        Assert.Equal(_product.Id, movement.ProductId);
        Assert.Equal(_source.Id, movement.FromShelfId);
        Assert.Equal(_target.Id, movement.ToShelfId);
        Assert.Equal(_user.Id, movement.CreatedBy);
        Assert.Equal(command.IdempotencyKey, movement.IdempotencyKey);
    }

    [Fact]
    public async Task ExistingDestinationBalanceIsIncrementedInsteadOfCreatingSecondRow()
    {
        await _context.GetCollection<Stock>().InsertOneAsync(Stock(_product.Id, _target.Id, 2));

        Assert.Equal(201, (await Handler().Handle(Command(), CancellationToken.None)).StatusCode);
        Assert.Equal(201, (await Handler().Handle(Command(2), CancellationToken.None)).StatusCode);

        var stocks = await Stocks();
        Assert.Equal(2, stocks.Count);
        Assert.Equal(5, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
        Assert.Equal(7, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
        Assert.Equal(12, stocks.Sum(x => x.Quantity));
        Assert.Equal(2, (await Movements()).Count);
    }

    [Fact]
    public async Task RetryReturnsIdenticalResultWithoutMovingStockAgain()
    {
        var command = Command();
        var first = await Handler().Handle(command, CancellationToken.None);
        await _context.GetCollection<Product>().UpdateOneAsync(x => x.Id == _product.Id,
            Builders<Product>.Update.Set(x => x.Status, false));
        await _context.GetCollection<Shelf>().UpdateOneAsync(x => x.Id == _target.Id,
            Builders<Shelf>.Update.Set(x => x.Status, false));
        await _context.GetCollection<User>().UpdateOneAsync(x => x.Id == _user.Id,
            Builders<User>.Update.Set(x => x.Name, "Değişmiş isim"));

        var retry = await Handler().Handle(command, CancellationToken.None);

        Assert.Equal(201, retry.StatusCode);
        Assert.Equal(JsonSerializer.Serialize(first.Data), JsonSerializer.Serialize(retry.Data));
        Assert.Equal(1, (await Movements()).Count);
        var stocks = await Stocks();
        Assert.Equal(7, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
        Assert.Equal(3, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
    }

    [Fact]
    public async Task SameKeyWithDifferentQuantityConflictsWithoutChangingStock()
    {
        var command = Command();
        Assert.Equal(201, (await Handler().Handle(command, CancellationToken.None)).StatusCode);
        var before = await StockSnapshot();
        command.Quantity = 4;

        var result = await Handler().Handle(command, CancellationToken.None);

        Assert.Equal(409, result.StatusCode);
        Assert.Equal(before, await StockSnapshot());
        Assert.Equal(1, (await Movements()).Count);
    }

    [Fact]
    public async Task ConcurrentSameKeyMovesStockOnlyOnce()
    {
        var key = Guid.NewGuid().ToString();
        var contexts = new[] { Context(), Context() };

        var results = await Task.WhenAll(Enumerable.Range(0, 12).Select(i =>
            Handler(contexts[i % 2]).Handle(Command(key: key), CancellationToken.None)));

        Assert.All(results, result => Assert.Equal(201, result.StatusCode));
        Assert.Single(results.Select(x => x.Data.Id).Distinct());
        var stocks = await Stocks();
        Assert.Equal(7, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
        Assert.Equal(3, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
        Assert.Equal(1, (await Movements()).Count);
    }

    [Fact]
    public async Task ConcurrentMovesCannotOverdrawSourceStock()
    {
        var contexts = new[] { Context(), Context() };

        var results = await Task.WhenAll(
            Handler(contexts[0]).Handle(Command(8), CancellationToken.None),
            Handler(contexts[1]).Handle(Command(8), CancellationToken.None));

        Assert.Equal(new[] { 201, 409 }, results.Select(x => x.StatusCode).Order().ToArray());
        var stocks = await Stocks();
        Assert.Equal(2, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
        Assert.Equal(8, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
        Assert.Equal(10, stocks.Sum(x => x.Quantity));
        Assert.Equal(1, (await Movements()).Count);
    }

    [Fact]
    public async Task ConcurrentMovesCannotOverfillDestinationShelf()
    {
        await _context.GetCollection<Shelf>().UpdateOneAsync(x => x.Id == _target.Id,
            Builders<Shelf>.Update.Set(x => x.Capacity, 5));
        var contexts = new[] { Context(), Context() };

        var results = await Task.WhenAll(
            Handler(contexts[0]).Handle(Command(), CancellationToken.None),
            Handler(contexts[1]).Handle(Command(), CancellationToken.None));

        Assert.Equal(new[] { 201, 409 }, results.Select(x => x.StatusCode).Order().ToArray());
        var stocks = await Stocks();
        Assert.Equal(7, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
        Assert.Equal(3, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
        Assert.Equal(1, (await Movements()).Count);
    }

    [Fact]
    public async Task ConcurrentReceiptAndPutawayPreserveEveryBalanceChange()
    {
        await _context.GetCollection<Stock>().UpdateOneAsync(x => x.ShelfId == _source.Id,
            Builders<Stock>.Update.Set(x => x.Quantity, 50));
        var operations = new List<Task>();
        for (var index = 0; index < 12; index++)
        {
            operations.Add(Receive());
            operations.Add(Move());
        }

        await Task.WhenAll(operations);

        var stocks = await Stocks();
        Assert.Equal(50, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
        Assert.Equal(12, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
        Assert.Equal(62, stocks.Sum(x => x.Quantity));
        Assert.Equal(12, await _context.GetCollection<Receipt>().CountDocumentsAsync(_ => true));
        Assert.Equal(24, (await Movements()).Count);

        async Task Receive()
        {
            var result = await ReceiptHandler(Context()).Handle(new CreateReceiptCommand
            {
                CreatedBy = _user.Id,
                ProductId = _product.Id,
                Supplier = "Test tedarikçi",
                Quantity = 1,
                IdempotencyKey = Guid.NewGuid().ToString()
            }, CancellationToken.None);
            Assert.Equal(201, result.StatusCode);
        }

        async Task Move()
        {
            var result = await Handler(Context()).Handle(Command(1), CancellationToken.None);
            Assert.Equal(201, result.StatusCode);
        }
    }

    [Theory]
    [InlineData("insufficient-stock", 409)]
    [InlineData("same-shelf", 400)]
    [InlineData("receiving-target", 400)]
    [InlineData("full-target", 409)]
    [InlineData("inactive-product", 409)]
    [InlineData("inactive-user", 401)]
    [InlineData("inactive-source", 409)]
    [InlineData("inactive-target", 409)]
    [InlineData("missing-product", 404)]
    [InlineData("missing-source", 404)]
    [InlineData("missing-target", 404)]
    public async Task InvalidMoveDoesNotChangeBalancesOrCreateMovement(string scenario, int statusCode)
    {
        var command = Command();
        if (scenario == "insufficient-stock") command.Quantity = 11;
        if (scenario == "same-shelf") command.TargetShelfCode = _source.Code;
        if (scenario == "receiving-target")
            await _context.GetCollection<Shelf>().UpdateOneAsync(x => x.Id == _target.Id,
                Builders<Shelf>.Update.Set(x => x.IsReceiving, true));
        if (scenario == "full-target")
            await _context.GetCollection<Stock>().InsertOneAsync(Stock(Id(), _target.Id, _target.Capacity));
        if (scenario == "inactive-product")
            await _context.GetCollection<Product>().UpdateOneAsync(x => x.Id == _product.Id,
                Builders<Product>.Update.Set(x => x.Status, false));
        if (scenario == "inactive-user")
            await _context.GetCollection<User>().UpdateOneAsync(x => x.Id == _user.Id,
                Builders<User>.Update.Set(x => x.Status, false));
        if (scenario == "inactive-source")
            await _context.GetCollection<Shelf>().UpdateOneAsync(x => x.Id == _source.Id,
                Builders<Shelf>.Update.Set(x => x.Status, false));
        if (scenario == "inactive-target")
            await _context.GetCollection<Shelf>().UpdateOneAsync(x => x.Id == _target.Id,
                Builders<Shelf>.Update.Set(x => x.Status, false));
        if (scenario == "missing-product") command.ProductBarcode = "missing-barcode";
        if (scenario == "missing-source") command.SourceShelfId = Id();
        if (scenario == "missing-target") command.TargetShelfCode = "MISSING";
        var before = await StockSnapshot();

        var result = await Handler().Handle(command, CancellationToken.None);

        Assert.Equal(statusCode, result.StatusCode);
        Assert.Equal(before, await StockSnapshot());
        Assert.Empty(await Movements());
    }

    [Fact]
    public async Task HttpEndpointUsesJwtIdentityAndEnforcesHeadersRolesAndReplay()
    {
        const string signingKey = "Logistic-putaway-integration-test-signing-key-2026";
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent!.Name;
        var apiDll = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,
            $"../../../../Logistic.API/bin/{configuration}/net10.0/Logistic.API.dll"));
        var start = new ProcessStartInfo("dotnet")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = Path.GetDirectoryName(apiDll)!
        };
        start.ArgumentList.Add(apiDll);
        start.ArgumentList.Add("--urls");
        start.ArgumentList.Add($"http://127.0.0.1:{port}");
        start.Environment["ConnectionStrings__DefaultConnection"] = _uri;
        start.Environment["Mongo__DatabaseName"] = _databaseName;
        start.Environment["keyjwt"] = signingKey;
        start.Environment["EncryptionKey"] = "0123456789abcdef0123456789abcdef";
        start.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
        using var process = Process.Start(start)!;
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        using var http = new HttpClient
        {
            BaseAddress = new Uri($"http://127.0.0.1:{port}"),
            Timeout = TimeSpan.FromSeconds(10)
        };
        try
        {
            var ready = false;
            for (var attempt = 0; attempt < 50; attempt++)
            {
                if (process.HasExited)
                    throw new Exception("API test sırasında kapandı: " + await outputTask + await errorTask);
                try
                {
                    using var check = await http.GetAsync("/swagger/v1/swagger.json");
                    if (check.IsSuccessStatusCode)
                    {
                        ready = true;
                        break;
                    }
                }
                catch (HttpRequestException) { }
                await Task.Delay(100);
            }
            Assert.True(ready, "API başlatılamadı.");

            using var noToken = await Send(null, "no-token");
            Assert.Equal(HttpStatusCode.Unauthorized, noToken.StatusCode);
            using var wrongRole = await Send(Token("Viewer"), "wrong-role");
            Assert.Equal(HttpStatusCode.Forbidden, wrongRole.StatusCode);
            using var noKey = await Send(Token("User"), null);
            Assert.Equal(HttpStatusCode.BadRequest, noKey.StatusCode);

            foreach (var role in new[] { "Admin", "Employee", "User" })
            {
                var key = Guid.NewGuid().ToString();
                using var first = await Send(Token(role), key);
                var originalJson = await first.Content.ReadAsStringAsync();
                Assert.True(first.StatusCode == HttpStatusCode.Created, originalJson);
                using var body = JsonDocument.Parse(originalJson);
                var data = body.RootElement.GetProperty("data");
                Assert.Equal(_user.Id, data.GetProperty("createdBy").GetString());
                Assert.Equal("Ogulcan Test", data.GetProperty("userName").GetString());
                Assert.Equal("putaway", data.GetProperty("type").GetString());
                Assert.Equal(_source.Id, data.GetProperty("fromShelfId").GetString());
                Assert.Equal(_target.Id, data.GetProperty("toShelfId").GetString());
                Assert.True(data.TryGetProperty("createdAt", out _));
                using var retry = await Send(Token(role), key);
                Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
                Assert.Equal(originalJson, await retry.Content.ReadAsStringAsync());
                using var changed = await Send(Token(role), key, 3);
                Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode);
            }

            var stocks = await Stocks();
            Assert.Equal(4, stocks.Single(x => x.ShelfId == _source.Id).Quantity);
            Assert.Equal(6, stocks.Single(x => x.ShelfId == _target.Id).Quantity);
            Assert.Equal(10, stocks.Sum(x => x.Quantity));
            Assert.Equal(3, (await Movements()).Count);
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync();
            await Task.WhenAll(outputTask, errorTask);
        }

        string Token(string role)
        {
            return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
                claims: new[]
                {
                    new Claim(JwtRegisteredClaimNames.Sub, _user.Id),
                    new Claim(ClaimTypes.Role, role)
                },
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: new SigningCredentials(
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256)));
        }

        Task<HttpResponseMessage> Send(string? token, string? key, int quantity = 2)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/Stock/Putaway")
            {
                Content = JsonContent.Create(new
                {
                    productBarcode = _product.Barcode,
                    sourceShelfId = _source.Id,
                    targetShelfCode = _target.Code,
                    quantity,
                    createdBy = Id(),
                    idempotencyKey = "body-key-is-ignored"
                })
            };
            if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (key is not null) request.Headers.Add("Idempotency-Key", key);
            return http.SendAsync(request);
        }
    }

    private MongoDbContext Context()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _uri,
                ["Mongo:DatabaseName"] = _databaseName
            }).Build();
        return new MongoDbContext(configuration);
    }

    private PutawayStockHandler Handler(MongoDbContext? context = null)
    {
        context = context ?? _context;
        return new PutawayStockHandler(
            new Repository<Product>(context),
            new Repository<Shelf>(context),
            new Repository<Stock>(context),
            new Repository<StockMovement>(context),
            new Repository<User>(context),
            ObjectMapper.Mapper,
            NullLogger<PutawayStockHandler>.Instance);
    }

    private CreateReceiptHandler ReceiptHandler(MongoDbContext context)
    {
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

    private PutawayStockCommand Command(int quantity = 3, string? key = null)
    {
        return new PutawayStockCommand
        {
            ProductBarcode = _product.Barcode,
            SourceShelfId = _source.Id,
            TargetShelfCode = _target.Code,
            Quantity = quantity,
            CreatedBy = _user.Id,
            IdempotencyKey = key ?? Guid.NewGuid().ToString()
        };
    }

    private Stock Stock(string productId, string shelfId, int quantity)
    {
        return new Stock
        {
            Id = Id(),
            ProductId = productId,
            ShelfId = shelfId,
            Quantity = quantity,
            CreatedBy = _user.Id,
            ModifiedBy = _user.Id
        };
    }

    private Task<List<Stock>> Stocks() => _context.GetCollection<Stock>().Find(_ => true).ToListAsync();
    private Task<List<StockMovement>> Movements() => _context.GetCollection<StockMovement>().Find(_ => true).ToListAsync();
    private async Task<string> StockSnapshot() => JsonSerializer.Serialize((await Stocks()).OrderBy(x => x.Id));
    private static string Id() => ObjectId.GenerateNewId().ToString();
}
