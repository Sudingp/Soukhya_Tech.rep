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

        public async Task<List<Attendance>> GetAllAsync()
        {
            var list = await _session.Query<Attendance>().ToListAsync();
            return list.OrderByDescending(a => a.Timestamp).ToList();
        }

        public async Task<List<Attendance>> GetByDateAsync(string dateStr)
        {
            var sql = "SELECT * FROM attendance WHERE date(timestamp) = date(:dateVal) ORDER BY timestamp DESC";
            var results = await _session.CreateSQLQuery(sql)
                .AddEntity(typeof(Attendance))
                .SetParameter("dateVal", dateStr)
                .ListAsync<Attendance>();

            return results.ToList();
        }

        public async Task<List<Attendance>> GetByEmpIdAsync(string empId)
        {
            var list = await _session.Query<Attendance>()
                .Where(a => a.EmpId == empId)
                .ToListAsync();
            return list.OrderByDescending(a => a.Timestamp).ToList();
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
            {
                await _session.DeleteAsync(item);
            }
            await tx.CommitAsync();
        }

        public async Task<bool> HasLoggedTodayAsync(string empId)
        {
            var sql = @"
                SELECT att_id FROM attendance 
                WHERE emp_id = :empId AND date(timestamp) = date('now','localtime') 
                LIMIT 1";

            var result = await _session.CreateSQLQuery(sql)
                .SetParameter("empId", empId)
                .UniqueResultAsync();

            return result != null;
        }

        public async Task<long> CountAsync()
        {
            return await _session.Query<Attendance>().LongCountAsync();
        }

        public async Task<(long PresentToday, long LateToday)> GetTodayStatsAsync()
        {
            var sql = @"
                SELECT 
                  COUNT(DISTINCT emp_id) AS PresentToday,
                  SUM(CASE WHEN status='Late' THEN 1 ELSE 0 END) AS LateToday
                FROM attendance
                WHERE date(timestamp) = date('now','localtime')";

            var queryResult = await _session.CreateSQLQuery(sql)
                .SetResultTransformer(NHibernate.Transform.Transformers.AliasToEntityMap)
                .UniqueResultAsync<System.Collections.IDictionary>();

            if (queryResult == null) return (0, 0);

            long present = queryResult["PresentToday"] != null && queryResult["PresentToday"] != DBNull.Value
                ? Convert.ToInt64(queryResult["PresentToday"]) : 0;

            long late = queryResult["LateToday"] != null && queryResult["LateToday"] != DBNull.Value
                ? Convert.ToInt64(queryResult["LateToday"]) : 0;

            return (present, late);
        }
    }
}
