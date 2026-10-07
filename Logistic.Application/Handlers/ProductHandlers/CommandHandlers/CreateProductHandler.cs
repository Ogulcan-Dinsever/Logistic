using AutoMapper;
using Logistic.Application.Commands.ProductCommands;
using Logistic.Application.Commands.ReceiptCommands;
using Logistic.Application.Interfaces;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Handlers.ProductHandlers.CommandHandlers
{
    public class CreateProductHandler : IRequestHandler<CreateProductCommand, Response<ProductResponse>>
    {
        private readonly IRepository<Product> _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<CreateProductHandler> _logger;

        public CreateProductHandler(IRepository<Product> repository, IMapper mapper, ILogger<CreateProductHandler> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }
        public async Task<Response<ProductResponse>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Ürün oluşturma işlemi başladı.");

            if (string.IsNullOrWhiteSpace(request.Name))
                return Response<ProductResponse>.Fail("Ürün adı boş olamaz.", 400);
            if (string.IsNullOrWhiteSpace(request.Sku))
                return Response<ProductResponse>.Fail("SKU boş olamaz.", 400);
            if (string.IsNullOrWhiteSpace(request.Barcode))
                return Response<ProductResponse>.Fail("Barkod boş olamaz.", 400);
            if (string.IsNullOrWhiteSpace(request.Category))
                return Response<ProductResponse>.Fail("Kategori boş olamaz.", 400);
            if (string.IsNullOrWhiteSpace(request.Unit))
                return Response<ProductResponse>.Fail("Birim boş olamaz.", 400);
            if (request.SalePrice <= 0)
                return Response<ProductResponse>.Fail("Satış fiyatı sıfırdan büyük olmalıdır.", 400);

            ProductResponse response = new ProductResponse();
            try
            {
                var product = _mapper.Map<Product>(request);

                await _repository.Create(product);

                response = _mapper.Map<ProductResponse>(product);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ürün oluşturma işlemi başarısız oldu.");

                return Response<ProductResponse>.Fail($"Ürün oluşturulurken bir hata oluştu: {ex.Message}", 500);
            }

            _logger.LogInformation("Ürün oluşturuldu. ProductId: {ProductId}", response.Id);

            return Response<ProductResponse>.Success(response, 201);
        }
    }
}
