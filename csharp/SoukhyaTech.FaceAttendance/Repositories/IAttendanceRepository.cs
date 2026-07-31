using SoukhyaTech.FaceAttendance.Models;

namespace SoukhyaTech.FaceAttendance.Repositories
{
    public interface IAttendanceRepository
    {
        Task<List<Attendance>> GetAllAsync();
        Task<List<Attendance>> GetByDateAsync(string dateStr);
        Task<List<Attendance>> GetByEmpIdAsync(string empId);
        Task SaveAsync(Attendance attendance);
        Task DeleteAsync(int attId);
        Task<bool> HasLoggedTodayAsync(string empId);
        Task<long> CountAsync();
        Task<(long PresentToday, long LateToday)> GetTodayStatsAsync();
    }
}
