using Logistic.API.Logging;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Logistic.Tests;

public class FileLoggerTests
{
    [Fact]
    public void MissingDirectoryIsCreatedAndTurkishMessageIsWritten()
    {
        using var directory = new TemporaryDirectory();
        var path = Path.Combine(directory.Path, "Logs", "logistic.txt");
        using var provider = new FileLoggerProvider(path);
        var logger = provider.CreateLogger("CreateReceiptHandler");

        logger.LogInformation("Mal kabul tamamlandı. Ürün: {ProductId}", "product-42");

        var content = File.ReadAllText(path);
        Assert.Contains("CreateReceiptHandler", content);
        Assert.Contains("Information", content);
        Assert.Contains("Mal kabul tamamlandı. Ürün: product-42", content);
    }

    [Fact]
    public void ExceptionTypeAndMessageAreWritten()
    {
        using var directory = new TemporaryDirectory();
        var path = Path.Combine(directory.Path, "logistic.txt");
        using var provider = new FileLoggerProvider(path);
        var logger = provider.CreateLogger("CreateProductHandler");
        var exception = new InvalidOperationException("Veritabanı bağlantısı başarısız.");

        logger.LogError(exception, "Ürün kaydedilemedi.");

        var content = File.ReadAllText(path);
        Assert.Contains("Error", content);
        Assert.Contains("Ürün kaydedilemedi.", content);
        Assert.Contains(exception.ToString(), content);
    }

    [Fact]
    public async Task ConcurrentLoggersWriteEveryMessageExactlyOnce()
    {
        using var directory = new TemporaryDirectory();
        var path = Path.Combine(directory.Path, "logistic.txt");
        using var provider = new FileLoggerProvider(path);
        var firstLogger = provider.CreateLogger("FirstHandler");
        var secondLogger = provider.CreateLogger("SecondHandler");

        await Task.WhenAll(Enumerable.Range(0, 40).Select(number => Task.Run(() =>
        {
            var logger = number % 2 == 0 ? firstLogger : secondLogger;
            logger.LogInformation("message-{Number:D3}", number);
        })));

        var lines = File.ReadAllLines(path);
        Assert.Equal(40, lines.Length);

        for (var number = 0; number < 40; number++)
        {
            var message = $"message-{number:D3}";
            Assert.Single(lines, line => line.Contains(message, StringComparison.Ordinal));
        }
    }

    [Fact]
    public void DebugAndNoneDoNotCreateLogFile()
    {
        using var directory = new TemporaryDirectory();
        var path = Path.Combine(directory.Path, "logistic.txt");
        using var provider = new FileLoggerProvider(path);
        var logger = provider.CreateLogger("TestHandler");

        logger.LogDebug("Bu mesaj dosyaya yazılmamalı.");
        logger.Log(LogLevel.None, "Bu mesaj da dosyaya yazılmamalı.");

        Assert.False(File.Exists(path));
    }

    [Fact]
    public void InvalidLogPathDoesNotBreakApplication()
    {
        using var directory = new TemporaryDirectory();
        Directory.CreateDirectory(directory.Path);
        var blockedDirectory = Path.Combine(directory.Path, "existing-file.txt");
        File.WriteAllText(blockedDirectory, "Bu bir dosyadır.");

        var exception = Record.Exception(() =>
        {
            using var provider = new FileLoggerProvider(Path.Combine(blockedDirectory, "logistic.txt"));
            provider.CreateLogger("TestHandler").LogInformation("İşlem devam edebilmeli.");
        });

        Assert.Null(exception);
        Assert.Equal("Bu bir dosyadır.", File.ReadAllText(blockedDirectory));
    }

    private sealed class TemporaryDirectory : IDisposable
    {
        private readonly string _temporaryRoot = System.IO.Path.GetFullPath(System.IO.Path.GetTempPath());

        public string Path { get; }

        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(_temporaryRoot, $"LogisticFileLoggerTests-{Guid.NewGuid():N}");
        }

        public void Dispose()
        {
            var fullPath = System.IO.Path.GetFullPath(Path);
            var rootPrefix = _temporaryRoot.TrimEnd(System.IO.Path.DirectorySeparatorChar)
                + System.IO.Path.DirectorySeparatorChar;

            if (fullPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase)
                && Directory.Exists(fullPath))
            {
                Directory.Delete(fullPath, recursive: true);
            }
        }
    }
}
