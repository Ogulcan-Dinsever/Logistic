using AutoMapper;
using Logistic.Application.Commands.StockCommands;
using Logistic.Application.Interfaces;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;

namespace Logistic.Application.Handlers.StockHandlers.CommandHandlers
{
    public class PutawayStockHandler : IRequestHandler<PutawayStockCommand, Response<StockMovementResponse>>
    {
        private readonly IRepository<Product> _productRepository;
        private readonly IRepository<Shelf> _shelfRepository;
        private readonly IRepository<Stock> _stockRepository;
        private readonly IRepository<StockMovement> _stockMovementRepository;
        private readonly IRepository<User> _userRepository;
        private readonly IMapper _mapper;
        private readonly ILogger<PutawayStockHandler> _logger;
        private static readonly SemaphoreSlim _lock = StockLock.Semaphore;

        public PutawayStockHandler(
            IRepository<Product> productRepository,
            IRepository<Shelf> shelfRepository,
            IRepository<Stock> stockRepository,
            IRepository<StockMovement> stockMovementRepository,
            IRepository<User> userRepository,
            IMapper mapper,
            ILogger<PutawayStockHandler> logger)
        {
            _productRepository = productRepository;
            _shelfRepository = shelfRepository;
            _stockRepository = stockRepository;
            _stockMovementRepository = stockMovementRepository;
            _userRepository = userRepository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<Response<StockMovementResponse>> Handle(PutawayStockCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Rafa yerleştirme işlemi başladı.");

            if (!ObjectId.TryParse(request.CreatedBy, out var userId))
                return Response<StockMovementResponse>.Fail("Kullanıcı bilgisi bulunamadı.", 401);

            if (string.IsNullOrWhiteSpace(request.ProductBarcode))
                return Response<StockMovementResponse>.Fail("Ürün barkodu boş olamaz.", 400);

            if (!ObjectId.TryParse(request.SourceShelfId, out var sourceShelfId))
                return Response<StockMovementResponse>.Fail("Geçerli bir kaynak raf seçmelisiniz.", 400);

            if (string.IsNullOrWhiteSpace(request.TargetShelfCode))
                return Response<StockMovementResponse>.Fail("Hedef raf kodu boş olamaz.", 400);

            if (request.Quantity <= 0)
                return Response<StockMovementResponse>.Fail("Miktar sıfırdan büyük olmalıdır.", 400);

            if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
                return Response<StockMovementResponse>.Fail("Idempotency-Key başlığı zorunludur.", 400);

            request.CreatedBy = userId.ToString();
            request.SourceShelfId = sourceShelfId.ToString();
            request.ProductBarcode = request.ProductBarcode.Trim();
            request.TargetShelfCode = request.TargetShelfCode.Trim().ToUpperInvariant();

            await _lock.WaitAsync(cancellationToken);

            try
            {
                var user = await _userRepository.Find(x => x.Id == request.CreatedBy && x.Status);

                if (user == null)
                    return Response<StockMovementResponse>.Fail("Kullanıcı bulunamadı veya aktif değil.", 401);

                var product = await _productRepository.Find(x => x.Barcode == request.ProductBarcode);

                if (product == null)
                    return Response<StockMovementResponse>.Fail("Ürün bulunamadı.", 404);

                var sourceShelf = await _shelfRepository.Find(x => x.Id == request.SourceShelfId);

                if (sourceShelf == null)
                    return Response<StockMovementResponse>.Fail("Kaynak raf bulunamadı.", 404);

                var targetShelf = await _shelfRepository.Find(x => x.Code == request.TargetShelfCode);

                if (targetShelf == null)
                    return Response<StockMovementResponse>.Fail("Hedef raf bulunamadı.", 404);

                var oldMovement = await _stockMovementRepository.Find(x =>
                    x.Type == "putaway" && x.CreatedBy == request.CreatedBy && x.IdempotencyKey == request.IdempotencyKey);

                if (oldMovement != null)
                {
                    if (oldMovement.ProductId != product.Id ||
                        oldMovement.FromShelfId != sourceShelf.Id ||
                        oldMovement.ToShelfId != targetShelf.Id ||
                        oldMovement.Quantity != request.Quantity)
                        return Response<StockMovementResponse>.Fail("Bu anahtar farklı bir istek için kullanılmış.", 409);

                    var oldResponse = _mapper.Map<StockMovementResponse>(oldMovement);

                    _logger.LogInformation("Önceki rafa yerleştirme sonucu döndürüldü. MovementId: {MovementId}", oldMovement.Id);

                    return Response<StockMovementResponse>.Success(oldResponse, 201);
                }

                if (!product.Status)
                    return Response<StockMovementResponse>.Fail("Ürün aktif değil.", 409);

                if (!sourceShelf.Status || !targetShelf.Status)
                    return Response<StockMovementResponse>.Fail("Kaynak ve hedef raf aktif olmalıdır.", 409);

                if (sourceShelf.Id == targetShelf.Id)
                    return Response<StockMovementResponse>.Fail("Kaynak ve hedef raf aynı olamaz.", 400);

                if (targetShelf.IsReceiving)
                    return Response<StockMovementResponse>.Fail("Hedef raf KABUL konumu olamaz.", 400);

                var sourceStock = await _stockRepository.Find(x =>
                    x.ProductId == product.Id && x.ShelfId == sourceShelf.Id && x.Status);

                if (sourceStock == null || sourceStock.Quantity < request.Quantity)
                    return Response<StockMovementResponse>.Fail("Kaynak rafta yeterli stok yok.", 409);

                var targetStocks = await _stockRepository.GetAll(x => x.ShelfId == targetShelf.Id);
                var totalQuantity = targetStocks.Sum(x => (long)x.Quantity);

                if (totalQuantity + request.Quantity > targetShelf.Capacity)
                    return Response<StockMovementResponse>.Fail("Hedef rafta yeterli yer yok.", 409);

                sourceStock.Quantity -= request.Quantity;
                sourceStock.ModifiedBy = request.CreatedBy;
                sourceStock.ModifiedDate = DateTime.UtcNow;

                await _stockRepository.Update(sourceStock);

                var targetStock = await _stockRepository.Find(x => x.ProductId == product.Id && x.ShelfId == targetShelf.Id);

                if (targetStock == null)
                {
                    targetStock = new Stock
                    {
                        ProductId = product.Id,
                        ShelfId = targetShelf.Id,
                        Quantity = request.Quantity,
                        CreatedBy = request.CreatedBy,
                        CreatedDate = DateTime.UtcNow
                    };

                    await _stockRepository.Create(targetStock);
                }
                else
                {
                    targetStock.Quantity += request.Quantity;
                    targetStock.Status = true;
                    targetStock.ModifiedBy = request.CreatedBy;
                    targetStock.ModifiedDate = DateTime.UtcNow;

                    await _stockRepository.Update(targetStock);
                }

                StockMovement movement = new StockMovement
                {
                    Type = "putaway",
                    ProductId = product.Id,
                    Quantity = request.Quantity,
                    FromShelfId = sourceShelf.Id,
                    ToShelfId = targetShelf.Id,
                    Reference = "RF-" + Guid.NewGuid().ToString("N"),
                    IdempotencyKey = request.IdempotencyKey,
                    CreatedBy = request.CreatedBy,
                    UserName = user.Name + " " + user.SurName,
                    CreatedDate = DateTime.UtcNow
                };

                await _stockMovementRepository.Create(movement);

                movement = await _stockMovementRepository.Find(x => x.Id == movement.Id);

                var response = _mapper.Map<StockMovementResponse>(movement);

                _logger.LogInformation("Rafa yerleştirme tamamlandı. MovementId: {MovementId}, ProductId: {ProductId}, Quantity: {Quantity}", response.Id, response.ProductId, response.Quantity);

                return Response<StockMovementResponse>.Success(response, 201);
            }
            finally
            {
                _lock.Release();
            }
        }
    }
}
