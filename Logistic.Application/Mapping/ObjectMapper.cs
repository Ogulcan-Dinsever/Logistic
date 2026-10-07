using AutoMapper;
using Microsoft.Extensions.Logging.Abstractions;

namespace Logistic.Application.Mapping
{
    public class ObjectMapper
    {
        private static readonly Lazy<IMapper> lazy = new Lazy<IMapper>(() =>
        {
            var config = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<AutoMapperProfile>();
            }, NullLoggerFactory.Instance);
            return config.CreateMapper();
        });
        public static IMapper Mapper => lazy.Value;
    }
}
