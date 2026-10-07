using AutoMapper;
using Logistic.Application.Commands.UserCommands;
using Logistic.Application.Interfaces;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Logistic.Application.Handlers.UserHandlers.CommandHandlers
{
    public class LoginHandler : IRequestHandler<LoginCommand, Response<UserResponse>>
    {
        private readonly IRepository<User> _repository;
        private readonly IConfiguration _configuration;
        private readonly IMapper _mapper;
        private readonly ILogger<LoginHandler> _logger;

        public LoginHandler(IRepository<User> repository, IConfiguration configuration, IMapper mapper, ILogger<LoginHandler> logger)
        {
            _repository = repository;
            _configuration = configuration;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<Response<UserResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Giriş işlemi başladı.");

            if (!GlobalFunctions.EmailControll(request.Email))
            {
                _logger.LogWarning("Giriş başarısız. E-posta formatı geçersiz.");
                return Response<UserResponse>.Fail("Please enter a correct e mail", 409);
            }

            var user = await _repository.Find(x => x.Status && x.Email == request.Email);

            if (user == null)
            {
                _logger.LogWarning("Giriş başarısız. Kullanıcı bulunamadı.");
                return Response<UserResponse>.Fail("Email address or username not found..", 409);
            }

            if (request.Password != GlobalFunctions.DecryptString(user.Password))
            {
                _logger.LogWarning("Giriş başarısız. Şifre yanlış.");
                return Response<UserResponse>.Fail("wrong password..", 409);
            }

            var response = _mapper.Map<UserResponse>(user);

            response.Token = await BuildToken(user.Id, user.Role);

            _logger.LogInformation("Giriş başarılı. UserId: {UserId}, Role: {Role}", user.Id, user.Role);

            return Response<UserResponse>.Success(response, 200);
        }

        private async Task<string> BuildToken(string userId, string userRole)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["keyjwt"]));
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId),
                    new Claim(ClaimTypes.Role, userRole)
                }),

                Expires = DateTime.UtcNow.AddYears(1),
                SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            var response = tokenHandler.WriteToken(token);

            return response;
        }
    }
}
