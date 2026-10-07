namespace Logistic.Application.Shared
{
    public static class StockLock
    {
        public static readonly SemaphoreSlim Semaphore = new SemaphoreSlim(1, 1);
    }
}
