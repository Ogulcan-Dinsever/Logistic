using AutoMapper;
using Logistic.Application.Commands.ProductCommands;
using Logistic.Application.Commands.ShelfCommands;
using Logistic.Application.Interfaces;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Handlers.ShelfHandlers.CommandHandlers
{
    public class CreateShelfHandler : IRequestHandler<CreateShelfCommand, Response<ShelfResponse>>
    {
        private readonly IRepository<Shelf> _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<CreateShelfHandler> _logger;

        public CreateShelfHandler(IRepository<Shelf> repository, IMapper mapper, ILogger<CreateShelfHandler> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }
        public async Task<Response<ShelfResponse>> Handle(CreateShelfCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Raf oluşturma işlemi başladı.");

            if (string.IsNullOrWhiteSpace(request.Code))
                return Response<ShelfResponse>.Fail("Raf kodu boş olamaz.", 400);
            if (string.IsNullOrWhiteSpace(request.Zone))
                return Response<ShelfResponse>.Fail("Raf konumu boş olamaz.", 400);
            if (request.Capacity <= 0)
                return Response<ShelfResponse>.Fail("Raf kapasitesi 0'dan büyük olmalıdır.", 400);

            ShelfResponse response = new ShelfResponse();
            try
            {
                var shelf = _mapper.Map<Shelf>(request);
                shelf.Code = request.Code.Trim().ToUpperInvariant();
                shelf.IsReceiving = shelf.Code == "KABUL";

                await _repository.Create(shelf);

                response = _mapper.Map<ShelfResponse>(shelf);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Raf oluşturma işlemi başarısız oldu.");

                return Response<ShelfResponse>.Fail($"Raf oluşturulurken bir hata oluştu: {ex.Message}", 500);
            }

            _logger.LogInformation("Raf oluşturuldu. ShelfId: {ShelfId}, Code: {Code}", response.Id, response.Code);

            return Response<ShelfResponse>.Success(response, 201);
        }
    }
}
