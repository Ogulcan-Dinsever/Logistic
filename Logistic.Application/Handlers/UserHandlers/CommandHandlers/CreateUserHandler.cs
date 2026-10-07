using AutoMapper;
using Logistic.Application.Commands.UserCommands;
using Logistic.Application.Interfaces;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Handlers.UserHandlers.CommandHandlers
{
    public class CreateUserHandler : IRequestHandler<CreateUserCommand, Response<UserResponse>>
    {
        private readonly IRepository<User> _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<CreateUserHandler> _logger;

        public CreateUserHandler(IRepository<User> repository, IMapper mapper, ILogger<CreateUserHandler> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<Response<UserResponse>> Handle(CreateUserCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Kullanıcı oluşturma işlemi başladı.");

            if (!GlobalFunctions.EmailControll(request.Email))
                return Response<UserResponse>.Fail("Please enter a correct e-mail", 409);

            if (String.IsNullOrWhiteSpace(request.Name) || String.IsNullOrWhiteSpace(request.SurName) || String.IsNullOrWhiteSpace(request.Password))
                return Response<UserResponse>.Fail("Name, Surname or Password cannot be empty", 409);

            var isThere = await _repository.Any(x => x.Status && x.Email == request.Email);

            if (isThere)
                return Response<UserResponse>.Fail("This email is already exist", 409);

            User user = new User
            {
                Email = request.Email,
                CreatedDate = DateTime.UtcNow,
                Password = GlobalFunctions.EncryptString(request.Password),
                Role = request.IsAdmin == true ? "Admin" : "User",
                Name = request.Name,
                SurName = request.SurName,
                CreatedBy = request.CreatedBy,
            };

            await _repository.Create(user);

            var response = _mapper.Map<UserResponse>(user);

            _logger.LogInformation("Kullanıcı oluşturuldu. UserId: {UserId}, Role: {Role}", user.Id, user.Role);

            return Response<UserResponse>.Success(response, 201);
        }
    }
}
