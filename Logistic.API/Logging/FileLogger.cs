using System.Text;

namespace Logistic.API.Logging
{
    public class FileLogger : ILogger
    {
        private static readonly object _lock = new object();
        private readonly string _filePath;
        private readonly string _categoryName;

        public FileLogger(string filePath, string categoryName)
        {
            _filePath = filePath;
            _categoryName = categoryName;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        {
            return null;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return logLevel >= LogLevel.Information && logLevel != LogLevel.None;
        }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
            Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
                return;

            var message = formatter(state, exception);
            var line = $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss.fff zzz} [{logLevel}] {_categoryName}: {message}{Environment.NewLine}";

            if (exception != null)
                line += exception.ToString() + Environment.NewLine;

            lock (_lock)
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
                    File.AppendAllText(_filePath, line, Encoding.UTF8);
                }
                catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
                {
                    Console.Error.WriteLine($"Log dosyasına yazılamadı: {ex.Message}");
                }
            }
        }
    }
}
