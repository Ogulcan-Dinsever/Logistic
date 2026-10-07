using Logistic.Application.Interfaces;
using Logistic.Domain.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using System.Linq.Expressions;
using MongoDB.Driver.Linq;

namespace Logistic.Application.Services
{
    public class Repository<T> : IRepository<T> where T : BaseEntity
    {
        private readonly IMongoCollection<T> _dbContext;
        public Repository(MongoDbContext context)
        {
            _dbContext = context.GetCollection<T>();
        }

        public async Task Create(T entity)
        {
            await _dbContext.InsertOneAsync(entity);
        }
        public async Task CreateAll(List<T> entities)
        {
            await _dbContext.InsertManyAsync(entities);
        }

        public async Task<T> Find(Expression<Func<T, bool>> expression)
        {
            var filter = Builders<T>.Filter.Where(expression);
            var result = await _dbContext.Find(filter).FirstOrDefaultAsync();
            return result;
        }

        public async Task<List<T>> GetAll()
        {
            return await _dbContext.Find(u => true).ToListAsync();
        }

        public async Task<List<T>> GetAll(Expression<Func<T, bool>> expression)
        {
            var filter = Builders<T>.Filter.Where(expression);
            var result = await _dbContext.Find(filter).ToListAsync();
            return result;
        }
        public async Task<List<T>> GetAllTake(Expression<Func<T, bool>> expression, int Take, int PageNum)
        {
            var startedData = (PageNum - 1) * Take;

            var filter = Builders<T>.Filter.Where(expression);
            return await _dbContext.AsQueryable()
                                    .Where(expression)
                                    .Skip(startedData)
                                    .Take(Take)
                                    .ToListAsync();
        }


        public async Task Update(T entity)
        {
            await _dbContext.ReplaceOneAsync(_ => _.Id == entity.Id, entity);
        }

        public async Task<bool> Any(Expression<Func<T, bool>> expression)
        {
            var filter = Builders<T>.Filter.Where(expression);
            var count = await _dbContext.CountDocumentsAsync(filter);
            return count > 0;
        }
        public async Task<int> Delete(Expression<Func<T, bool>> entity)
        {
            var filter = Builders<T>.Filter.Where(entity);
            var result = _dbContext.FindOneAndDelete(filter);
            return 1;
        }
    }
}
