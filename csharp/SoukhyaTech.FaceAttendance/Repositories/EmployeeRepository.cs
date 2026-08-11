using NHibernate.Linq;
using SoukhyaTech.FaceAttendance.Models;
using ISession = NHibernate.ISession;

namespace SoukhyaTech.FaceAttendance.Repositories
{
    public class EmployeeRepository : IEmployeeRepository
    {
        private readonly ISession _session;

        public EmployeeRepository(ISession session)
        {
            _session = session;
        }

        public async Task<List<Employee>> GetAllAsync(int page, int size)
        {
            return await _session.Query<Employee>()
                .OrderByDescending(e => e.CreatedAt)
                .Skip((page - 1) * size)
                .Take(size)
                .ToListAsync();
        }

        public async Task<Employee?> GetByIdAsync(string id)
        {
            return await _session.GetAsync<Employee>(id);
        }

        public async Task SaveOrUpdateAsync(Employee employee)
        {
            using var tx = _session.BeginTransaction();
            await _session.SaveOrUpdateAsync(employee);
            await tx.CommitAsync();
        }

        public async Task DeleteAsync(Employee employee)
        {
            using var tx = _session.BeginTransaction();
            await _session.DeleteAsync(employee);
            await tx.CommitAsync();
        }

        public async Task<bool> ExistsAsync(string id)
        {
            return await _session.GetAsync<Employee>(id) != null;
        }

        public async Task<long> CountAsync()
        {
            return await _session.Query<Employee>().LongCountAsync();
        }

        public async Task<long> CountByStatusAsync(string status)
        {
            return await _session.Query<Employee>()
                .Where(e => e.Status == status)
                .LongCountAsync();
        }

        public async Task<List<object>> GetDeptHibernateCountsAsync()
        {
            var sql = @"
                SELECT department as Department, COUNT(*) as Count
                FROM employees
                WHERE status = 'Hibernate'
                GROUP BY department";
            var results = await _session.CreateSQLQuery(sql)
                .SetResultTransformer(NHibernate.Transform.Transformers.AliasToEntityMap)
                .ListAsync<System.Collections.IDictionary>();

            return results.Select(row => new
            {
                department = row["Department"]?.ToString() ?? "",
                count = Convert.ToInt64(row["Count"])
            }).Cast<object>().ToList();
        }

        public async Task<List<object>> GetMonthlyHibernateTrendsAsync()
        {
            var sql = @"
                SELECT substr(hibernate_start_date, 1, 7) as Month, COUNT(*) as Count
                FROM employees
                WHERE status = 'Hibernate' AND hibernate_start_date IS NOT NULL AND hibernate_start_date != ''
                GROUP BY Month
                ORDER BY Month ASC";
            var results = await _session.CreateSQLQuery(sql)
                .SetResultTransformer(NHibernate.Transform.Transformers.AliasToEntityMap)
                .ListAsync<System.Collections.IDictionary>();

            return results.Select(row => new
            {
                month = row["Month"]?.ToString() ?? "",
                count = Convert.ToInt64(row["Count"])
            }).Cast<object>().ToList();
        }
    }
}
