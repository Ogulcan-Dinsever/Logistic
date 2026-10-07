using Logistic.Domain.Common;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;

namespace Logistic.Application.Services
{
    public class MongoDbContext
    {
        public IMongoDatabase Database { get; }

        public MongoDbContext(IConfiguration configuration)
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection");
            var client = new MongoClient(connectionString);
            var databaseName = configuration["Mongo:DatabaseName"] ?? "Logistic";

            Database = client.GetDatabase(databaseName);
        }

        public IMongoCollection<T> GetCollection<T>() where T : BaseEntity
        {
            return Database.GetCollection<T>(typeof(T).FullName);
        }
    }
}
