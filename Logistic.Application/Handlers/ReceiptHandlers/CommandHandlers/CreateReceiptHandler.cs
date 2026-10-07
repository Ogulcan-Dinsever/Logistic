using AutoMapper;
using Logistic.Application.Commands.ReceiptCommands;
using Logistic.Application.Interfaces;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;

namespace Logistic.Application.Handlers.ReceiptHandlers.CommandHandlers
{
    public class CreateReceiptHandler : IRequestHandler<CreateReceiptCommand, Response<ReceiptResponse>>
    {
        private readonly IRepository<Receipt> _repository;
        private readonly IRepository<Product> _productRepository;
        private readonly IRepository<Shelf> _shelfRepository;
        private readonly IRepository<Stock> _stockRepository;
        private readonly IRepository<StockMovement> _stockMovementRepository;
        private readonly IRepository<User> _userRepository;
        private readonly IMapper _mapper;
        private readonly ILogger<CreateReceiptHandler> _logger;
        private static readonly SemaphoreSlim _lock = StockLock.Semaphore;

        public CreateReceiptHandler(
            IRepository<Receipt> repository,
            IRepository<Product> productRepository,
            IRepository<Shelf> shelfRepository,
            IRepository<Stock> stockRepository,
            IRepository<StockMovement> stockMovementRepository,
            IRepository<User> userRepository,
            IMapper mapper,
            ILogger<CreateReceiptHandler> logger)
        {
            _repository = repository;
            _productRepository = productRepository;
            _shelfRepository = shelfRepository;
            _stockRepository = stockRepository;
            _stockMovementRepository = stockMovementRepository;
            _userRepository = userRepository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<Response<ReceiptResponse>> Handle(CreateReceiptCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Mal kabul işlemi başladı.");

            if (!ObjectId.TryParse(request.CreatedBy, out var userId))
                return Response<ReceiptResponse>.Fail("Kullanıcı bilgisi bulunamadı.", 401);

            if (!ObjectId.TryParse(request.ProductId, out var productId))
                return Response<ReceiptResponse>.Fail("Geçerli bir ürün seçmelisiniz.", 400);

            if (request.Quantity <= 0)
                return Response<ReceiptResponse>.Fail("Miktar sıfırdan büyük olmalıdır.", 400);

            if (string.IsNullOrWhiteSpace(request.Supplier))
                return Response<ReceiptResponse>.Fail("Tedarikçi boş olamaz.", 400);

            if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
                return Response<ReceiptResponse>.Fail("Idempotency-Key başlığı zorunludur.", 400);

            request.CreatedBy = userId.ToString();
            request.ProductId = productId.ToString();

            await _lock.WaitAsync(cancellationToken);

            try
            {
                var user = await _userRepository.Find(x => x.Id == request.CreatedBy && x.Status);

                if (user == null)
                    return Response<ReceiptResponse>.Fail("Kullanıcı bulunamadı veya aktif değil.", 401);

                var oldReceipt = await _repository.Find(x =>
                    x.CreatedBy == request.CreatedBy && x.IdempotencyKey == request.IdempotencyKey);

                if (oldReceipt != null)
                {
                    if (oldReceipt.ProductId != request.ProductId ||
                        oldReceipt.Quantity != request.Quantity ||
                        oldReceipt.Supplier != request.Supplier ||
                        oldReceipt.Note != (request.Note ?? string.Empty))
                        return Response<ReceiptResponse>.Fail("Bu anahtar farklı bir istek için kullanılmış.", 409);

                    var oldResponse = _mapper.Map<ReceiptResponse>(oldReceipt);

                    _logger.LogInformation("Önceki mal kabul sonucu döndürüldü. ReceiptId: {ReceiptId}", oldReceipt.Id);

                    return Response<ReceiptResponse>.Success(oldResponse, 201);
                }

                var product = await _productRepository.Find(x => x.Id == request.ProductId && x.Status);

                if (product == null)
                    return Response<ReceiptResponse>.Fail("Ürün bulunamadı veya aktif değil.", 404);

                var shelf = await _shelfRepository.Find(x => x.IsReceiving && x.Status);

                if (shelf == null)
                    return Response<ReceiptResponse>.Fail("KABUL konumu bulunamadı.", 409);

                var stocks = await _stockRepository.GetAll(x => x.ShelfId == shelf.Id);
                var totalQuantity = stocks.Sum(x => (long)x.Quantity);

                if (totalQuantity + request.Quantity > shelf.Capacity)
                    return Response<ReceiptResponse>.Fail("KABUL konumunda yeterli yer yok.", 409);

                Receipt receipt = new Receipt
                {
                    Reference = "MK-" + Guid.NewGuid().ToString("N"),
                    Supplier = request.Supplier,
                    ProductId = product.Id,
                    Quantity = request.Quantity,
                    Note = request.Note ?? string.Empty,
                    IdempotencyKey = request.IdempotencyKey,
                    CreatedBy = request.CreatedBy,
                    UserName = user.Name + " " + user.SurName,
                    CreatedDate = DateTime.UtcNow
                };

                await _repository.Create(receipt);

                var stock = await _stockRepository.Find(x => x.ProductId == product.Id && x.ShelfId == shelf.Id);

                if (stock == null)
                {
                    stock = new Stock
                    {
                        ProductId = product.Id,
                        ShelfId = shelf.Id,
                        Quantity = request.Quantity,
                        CreatedBy = request.CreatedBy,
                        CreatedDate = DateTime.UtcNow
                    };

                    await _stockRepository.Create(stock);
                }
                else
                {
                    stock.Quantity += request.Quantity;
                    stock.Status = true;
                    stock.ModifiedBy = request.CreatedBy;
                    stock.ModifiedDate = DateTime.UtcNow;

                    await _stockRepository.Update(stock);
                }

                StockMovement movement = new StockMovement
                {
                    Type = "receipt",
                    ProductId = product.Id,
                    Quantity = request.Quantity,
                    FromShelfId = null,
                    ToShelfId = shelf.Id,
                    ReceiptId = receipt.Id,
                    Reference = receipt.Reference,
                    CreatedBy = request.CreatedBy,
                    CreatedDate = DateTime.UtcNow
                };

                await _stockMovementRepository.Create(movement);

                receipt = await _repository.Find(x => x.Id == receipt.Id);

                var response = _mapper.Map<ReceiptResponse>(receipt);

                _logger.LogInformation("Mal kabul tamamlandı. ReceiptId: {ReceiptId}, ProductId: {ProductId}, Quantity: {Quantity}", response.Id, response.ProductId, response.Quantity);

                return Response<ReceiptResponse>.Success(response, 201);
            }
            finally
            {
                _lock.Release();
            }
        }
    }
}
