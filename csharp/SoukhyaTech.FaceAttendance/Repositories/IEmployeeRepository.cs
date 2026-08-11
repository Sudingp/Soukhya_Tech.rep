using SoukhyaTech.FaceAttendance.Models;

namespace SoukhyaTech.FaceAttendance.Repositories
{
    public interface IEmployeeRepository
    {
        Task<List<Employee>> GetAllAsync(int page, int size);
        Task<Employee?> GetByIdAsync(string id);
        Task SaveOrUpdateAsync(Employee employee);
        Task DeleteAsync(Employee employee);
        Task<bool> ExistsAsync(string id);
        Task<long> CountAsync();
        Task<long> CountByStatusAsync(string status);
        Task<List<object>> GetDeptHibernateCountsAsync();
        Task<List<object>> GetMonthlyHibernateTrendsAsync();
    }
}
