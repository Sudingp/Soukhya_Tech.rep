using SoukhyaTech.FaceAttendance.Models;

namespace SoukhyaTech.FaceAttendance.Repositories
{
    public interface IAttendanceRepository
    {
        Task<List<Attendance>> GetAllAsync(int page, int size);
        Task<List<Attendance>> GetByDateRangeAsync(string start, string end);
        Task<List<Attendance>> GetByEmpIdAsync(string empId);
        Task SaveAsync(Attendance attendance);
        Task DeleteAsync(int attId);
        Task<bool> HasLoggedTodayAsync(string empId, string start, string end);
        Task<long> CountAsync();
        Task<(long PresentToday, long LateToday)> GetTodayStatsAsync(string start, string end);
    }
}
