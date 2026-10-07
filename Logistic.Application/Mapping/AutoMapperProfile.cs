using AutoMapper;
using System;
using System.Collections.Generic;
using System.Text;
using Logistic.Domain.Aggregate;
using Logistic.Application.Responses;
using Logistic.Application.Commands.ProductCommands;
using Logistic.Application.Commands.ShelfCommands;

namespace Logistic.Application.Mapping
{
    public class AutoMapperProfile : Profile
    {
        public AutoMapperProfile()
        {
            CreateMap<Receipt, ReceiptResponse>();
            CreateMap<User, UserResponse>().ReverseMap();
            CreateMap<Shelf, ShelfResponse>().ReverseMap();
            CreateMap<CreateProductCommand, Product>();
            CreateMap<Product, ProductResponse>()
                .ForMember(dest => dest.IsActive,
                    opt => opt.MapFrom(src => src.Status));
            CreateMap<CreateShelfCommand, Shelf>();
            CreateMap<Stock, StockResponse>();
            CreateMap<StockMovement, StockMovementResponse>();
        }
    }
}
