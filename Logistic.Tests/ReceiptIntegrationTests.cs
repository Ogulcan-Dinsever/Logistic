using System.Text.Json;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Claims;
using System.Text;
using Logistic.Application.Commands.ReceiptCommands;
using Logistic.Application.Handlers.ReceiptHandlers.CommandHandlers;
using Logistic.Application.Services;
using Logistic.Application.Mapping;
using Logistic.Domain.Aggregate;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;

namespace Logistic.Tests;

[Trait("Category", "Integration")]
public class ReceiptIntegrationTests : IAsyncLifetime
{
    private readonly string _databaseName = "logistic_receipt_test_" + Guid.NewGuid().ToString("N");
    private string _uri = "";
    private MongoDbContext _context = null!;
    private User _user = null!;
    private Product _product = null!;
    private Shelf _shelf = null!;

    public async Task InitializeAsync()
    {
        _uri = Environment.GetEnvironmentVariable("LOGISTIC_TEST_MONGO_URI")
            ?? throw new InvalidOperationException("Integration testleri için LOGISTIC_TEST_MONGO_URI bir MongoDB bağlantısı olmalıdır.");
        _context = Context();
        _user = new User { Id = Id(), Name = "Ogulcan", SurName = "Test", Email = "test@example.invalid",
            Password = "test-only", Role = "Employee", CreatedBy = "test", ModifiedBy = "test" };
        _product = new Product { Id = Id(), Name = "Test ürün", Barcode = "8690000000001", Sku = "TEST-01",
            CreatedBy = _user.Id, ModifiedBy = _user.Id };
        _shelf = new Shelf { Id = Id(), Code = "KABUL", Zone = "Mal Kabul", Capacity = 100, IsReceiving = true,
            CreatedBy = _user.Id, ModifiedBy = _user.Id };
        await _context.GetCollection<User>().InsertOneAsync(_user);
        await _context.GetCollection<Product>().InsertOneAsync(_product);
        await _context.GetCollection<Shelf>().InsertOneAsync(_shelf);
    }

    public async Task DisposeAsync()
    {
        if (_context is not null && _databaseName.StartsWith("logistic_receipt_test_", StringComparison.Ordinal))
            await _context.Database.Client.DropDatabaseAsync(_databaseName);
    }

    [Fact]
    public async Task ReceiptCreatesBalanceAndMovementWithAuthenticatedActor()
    {
        var result = await Handler().Handle(Command(), CancellationToken.None);
        Assert.Equal(201, result.StatusCode);
        Assert.Equal(_user.Id, result.Data.CreatedBy);
        Assert.Equal("Ogulcan Test", result.Data.UserName);
        var receipt = Assert.Single(await _context.GetCollection<Receipt>().Find(_ => true).ToListAsync());
        var stock = Assert.Single(await _context.GetCollection<Stock>().Find(_ => true).ToListAsync());
        var movement = Assert.Single(await _context.GetCollection<StockMovement>().Find(_ => true).ToListAsync());
        Assert.Equal(10, stock.Quantity);
        Assert.Equal(_shelf.Id, stock.ShelfId);
        Assert.Equal("receipt", movement.Type);
        Assert.Null(movement.FromShelfId);
        Assert.Equal(_shelf.Id, movement.ToShelfId);
        Assert.Equal(receipt.Id, movement.ReceiptId);
        Assert.Equal(receipt.Reference, movement.Reference);
        Assert.Equal(_user.Id, movement.CreatedBy);
    }

    [Fact]
    public async Task RetryReturnsIdenticalResponseWithoutAddingStockEvenAfterProductIsDisabled()
    {
        var command = Command();
        var first = await Handler().Handle(command, CancellationToken.None);
        await _context.GetCollection<Product>().UpdateOneAsync(x => x.Id == _product.Id,
            Builders<Product>.Update.Set(x => x.Status, false));
        await _context.GetCollection<User>().UpdateOneAsync(x => x.Id == _user.Id,
            Builders<User>.Update.Set(x => x.Name, "Değişmiş isim"));
        var retry = await Handler().Handle(command, CancellationToken.None);
        Assert.Equal(201, retry.StatusCode);
        Assert.Equal(JsonSerializer.Serialize(first.Data), JsonSerializer.Serialize(retry.Data));
        Assert.Equal(1, await _context.GetCollection<Receipt>().CountDocumentsAsync(_ => true));
        Assert.Equal(1, await _context.GetCollection<StockMovement>().CountDocumentsAsync(_ => true));
        Assert.Equal(10, (await _context.GetCollection<Stock>().Find(_ => true).SingleAsync()).Quantity);
    }

    [Fact]
    public async Task SameKeyWithDifferentPayloadConflicts()
    {
        var command = Command();
        await Handler().Handle(command, CancellationToken.None);
        command.Quantity = 11;
        Assert.Equal(409, (await Handler().Handle(command, CancellationToken.None)).StatusCode);
        Assert.Equal(10, (await _context.GetCollection<Stock>().Find(_ => true).SingleAsync()).Quantity);
    }

    [Fact]
    public async Task ConcurrentSameKeyInOneApiAddsStockOnlyOnce()
    {
        var key = Guid.NewGuid().ToString();
        var contexts = new[] { Context(), Context() };
        var results = await Task.WhenAll(Enumerable.Range(0, 12).Select(i =>
            Handler(contexts[i % 2]).Handle(Command(key: key), CancellationToken.None)));
        Assert.All(results, x => Assert.Equal(201, x.StatusCode));
        Assert.Single(results.Select(x => x.Data.Id).Distinct());
        Assert.Equal(1, await _context.GetCollection<Receipt>().CountDocumentsAsync(_ => true));
        Assert.Equal(1, await _context.GetCollection<StockMovement>().CountDocumentsAsync(_ => true));
        Assert.Equal(10, (await _context.GetCollection<Stock>().Find(_ => true).SingleAsync()).Quantity);
    }

    [Fact]
    public async Task ConcurrentReceiptsCannotOverfillReceivingShelf()
    {
        var otherProduct = new Product { Id = Id(), Name = "İkinci ürün", CreatedBy = _user.Id, ModifiedBy = _user.Id };
        await _context.GetCollection<Product>().InsertOneAsync(otherProduct);
        var second = Command(60);
        second.ProductId = otherProduct.Id;
        var contexts = new[] { Context(), Context() };
        var results = await Task.WhenAll(
            Handler(contexts[0]).Handle(Command(60), CancellationToken.None),
            Handler(contexts[1]).Handle(second, CancellationToken.None));
        Assert.Equal(new[] { 201, 409 }, results.Select(x => x.StatusCode).Order().ToArray());
        Assert.Equal(60, (await _context.GetCollection<Stock>().Find(_ => true).ToListAsync()).Sum(x => x.Quantity));
        Assert.Equal(1, await _context.GetCollection<Receipt>().CountDocumentsAsync(_ => true));
    }

    [Fact]
    public async Task NewKeyIncrementsExistingBalanceInsteadOfCreatingSecondRow()
    {
        await Handler().Handle(Command(), CancellationToken.None);
        await Handler().Handle(Command(15), CancellationToken.None);
        var stock = Assert.Single(await _context.GetCollection<Stock>().Find(_ => true).ToListAsync());
        Assert.Equal(25, stock.Quantity);
        Assert.Equal(2, await _context.GetCollection<Receipt>().CountDocumentsAsync(_ => true));
        Assert.Equal(2, await _context.GetCollection<StockMovement>().CountDocumentsAsync(_ => true));
    }

    [Fact]
    public async Task SameKeyForDifferentUsersRepresentsSeparateReceipts()
    {
        var other = new User { Id = Id(), Name = "İkinci", SurName = "Kullanıcı", Email = "other@example.invalid",
            Password = "test-only", Role = "Admin", CreatedBy = "test", ModifiedBy = "test" };
        await _context.GetCollection<User>().InsertOneAsync(other);
        var key = Guid.NewGuid().ToString();
        var second = Command(key: key);
        second.CreatedBy = other.Id;
        Assert.Equal(201, (await Handler().Handle(Command(key: key), CancellationToken.None)).StatusCode);
        Assert.Equal(201, (await Handler().Handle(second, CancellationToken.None)).StatusCode);
        Assert.Equal(20, (await _context.GetCollection<Stock>().Find(_ => true).SingleAsync()).Quantity);
    }

    [Theory]
    [InlineData("product", 404)]
    [InlineData("user", 401)]
    [InlineData("shelf", 409)]
    public async Task InactiveOrMissingEntitiesDoNotChangeStock(string entity, int statusCode)
    {
        if (entity == "product")
            await _context.GetCollection<Product>().UpdateOneAsync(x => x.Id == _product.Id,
                Builders<Product>.Update.Set(x => x.Status, false));
        else if (entity == "user")
            await _context.GetCollection<User>().UpdateOneAsync(x => x.Id == _user.Id,
                Builders<User>.Update.Set(x => x.Status, false));
        else
            await _context.GetCollection<Shelf>().DeleteOneAsync(x => x.Id == _shelf.Id);
        Assert.Equal(statusCode, (await Handler().Handle(Command(), CancellationToken.None)).StatusCode);
        Assert.Equal(0, await _context.GetCollection<Receipt>().CountDocumentsAsync(_ => true));
        Assert.Equal(0, await _context.GetCollection<Stock>().CountDocumentsAsync(_ => true));
    }

    private MongoDbContext Context() => new(new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = _uri, ["Mongo:DatabaseName"] = _databaseName
        }).Build());

    [Fact]
    public async Task HttpEndpointUsesJwtIdentityAndEnforcesHeadersRolesAndReplay()
    {
        const string signingKey = "Logistic-integration-test-signing-key-2026";
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent!.Name;
        var apiDll = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,
            $"../../../../Logistic.API/bin/{configuration}/net10.0/Logistic.API.dll"));
        var start = new ProcessStartInfo("dotnet")
        {
            UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true,
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
        using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}"),
            Timeout = TimeSpan.FromSeconds(10) };
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
                    if (check.IsSuccessStatusCode) { ready = true; break; }
                }
                catch (HttpRequestException) { }
                await Task.Delay(100);
            }
            Assert.True(ready, "API başlatılamadı.");

            using var noToken = await Send(null, "no-token");
            Assert.Equal(HttpStatusCode.Unauthorized, noToken.StatusCode);
            using var wrongRole = await Send(Token("Viewer"), "wrong-role");
            Assert.Equal(HttpStatusCode.Forbidden, wrongRole.StatusCode);
            using var noKey = await Send(Token("Employee"), null);
            Assert.Equal(HttpStatusCode.BadRequest, noKey.StatusCode);

            foreach (var role in new[] { "Admin", "Employee", "User" })
            {
                var key = Guid.NewGuid().ToString();
                using var first = await Send(Token(role), key);
                Assert.True(first.StatusCode == HttpStatusCode.Created, await first.Content.ReadAsStringAsync());
                var originalJson = await first.Content.ReadAsStringAsync();
                using var body = JsonDocument.Parse(originalJson);
                Assert.Equal(_user.Id, body.RootElement.GetProperty("data").GetProperty("createdBy").GetString());
                Assert.Equal("Ogulcan Test", body.RootElement.GetProperty("data").GetProperty("userName").GetString());
                Assert.True(body.RootElement.GetProperty("data").TryGetProperty("createdAt", out _));
                using var retry = await Send(Token(role), key);
                Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
                Assert.Equal(originalJson, await retry.Content.ReadAsStringAsync());
                using var changed = await Send(Token(role), key, 3);
                Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode);
            }
            Assert.Equal(3, await _context.GetCollection<Receipt>().CountDocumentsAsync(_ => true));
            Assert.Equal(6, (await _context.GetCollection<Stock>().Find(_ => true).SingleAsync()).Quantity);
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync();
            await Task.WhenAll(outputTask, errorTask);
        }

        string Token(string role) => new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            claims: new[] { new Claim(JwtRegisteredClaimNames.Sub, _user.Id), new Claim(ClaimTypes.Role, role) },
            expires: DateTime.UtcNow.AddMinutes(5), signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256)));

        Task<HttpResponseMessage> Send(string? token, string? key, int quantity = 2)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/Receipt")
            {
                Content = JsonContent.Create(new { supplier = "HTTP tedarikçi", productId = _product.Id,
                    quantity, note = "HTTP test", createdBy = Id(), idempotencyKey = "body-key-is-ignored" })
            };
            if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (key is not null) request.Headers.Add("Idempotency-Key", key);
            return http.SendAsync(request);
        }
    }

    private CreateReceiptHandler Handler(MongoDbContext? context = null)
    {
        context = context ?? _context;

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
    private CreateReceiptCommand Command(int quantity = 10, string? key = null) => new()
    {
        Supplier = "Test tedarikçi", ProductId = _product.Id, Quantity = quantity, Note = "Test notu",
        CreatedBy = _user.Id, IdempotencyKey = key ?? Guid.NewGuid().ToString()
    };
    private static string Id() => ObjectId.GenerateNewId().ToString();
}
