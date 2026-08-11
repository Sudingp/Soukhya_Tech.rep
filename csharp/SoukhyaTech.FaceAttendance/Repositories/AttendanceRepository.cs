using NHibernate.Linq;
using SoukhyaTech.FaceAttendance.Models;
using ISession = NHibernate.ISession;

namespace SoukhyaTech.FaceAttendance.Repositories
{
    public class AttendanceRepository : IAttendanceRepository
    {
        private readonly ISession _session;

        public AttendanceRepository(ISession session)
        {
            _session = session;
        }

        public async Task<List<Attendance>> GetAllAsync(int page, int size)
        {
            return await _session.Query<Attendance>()
                .OrderByDescending(a => a.Timestamp)
                .Skip((page - 1) * size)
                .Take(size)
                .ToListAsync();
        }

        public async Task<List<Attendance>> GetByDateRangeAsync(string start, string end)
        {
            return await _session.Query<Attendance>()
                .Where(a => a.Timestamp >= start && a.Timestamp < end)
                .OrderByDescending(a => a.Timestamp)
                .ToListAsync();
        }

        public async Task<List<Attendance>> GetByEmpIdAsync(string empId)
        {
            return await _session.Query<Attendance>()
                .Where(a => a.EmpId == empId)
                .OrderByDescending(a => a.Timestamp)
                .ToListAsync();
        }

        public async Task SaveAsync(Attendance attendance)
        {
            using var tx = _session.BeginTransaction();
            await _session.SaveAsync(attendance);
            await tx.CommitAsync();
        }

        public async Task DeleteAsync(int attId)
        {
            using var tx = _session.BeginTransaction();
            var item = await _session.GetAsync<Attendance>(attId);
            if (item != null)
                await _session.DeleteAsync(item);
            await tx.CommitAsync();
        }

        public async Task<bool> HasLoggedTodayAsync(string empId, string start, string end)
        {
            return await _session.Query<Attendance>()
                .Where(a => a.EmpId == empId && a.Timestamp >= start && a.Timestamp < end)
                .AnyAsync();
        }

        public async Task<long> CountAsync()
        {
            return await _session.Query<Attendance>().LongCountAsync();
        }

        public async Task<(long PresentToday, long LateToday)> GetTodayStatsAsync(string start, string end)
        {
            var sql = @"
                SELECT COUNT(DISTINCT emp_id) AS PresentToday,
                       COALESCE(SUM(CASE WHEN status='Late' THEN 1 ELSE 0 END), 0) AS LateToday
                FROM attendance
                WHERE timestamp >= :start AND timestamp < :end";

            var queryResult = await _session.CreateSQLQuery(sql)
                .SetParameter("start", start)
                .SetParameter("end", end)
                .SetResultTransformer(NHibernate.Transform.Transformers.AliasToEntityMap)
                .UniqueResultAsync<System.Collections.IDictionary>();

            if (queryResult == null) return (0, 0);
            long present = queryResult["PresentToday"] != null ? Convert.ToInt64(queryResult["PresentToday"]) : 0;
            long late = queryResult["LateToday"] != null ? Convert.ToInt64(queryResult["LateToday"]) : 0;
            return (present, late);
        }
    }
}
