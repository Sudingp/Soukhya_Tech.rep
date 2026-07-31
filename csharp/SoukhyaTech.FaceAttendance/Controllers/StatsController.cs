using Microsoft.AspNetCore.Mvc;
using SoukhyaTech.FaceAttendance.Repositories;

namespace SoukhyaTech.FaceAttendance.Controllers
{
    [ApiController]
    public class StatsController : ControllerBase
    {
        private readonly IEmployeeRepository _employeeRepo;
        private readonly IAttendanceRepository _attendanceRepo;

        public StatsController(IEmployeeRepository employeeRepo, IAttendanceRepository attendanceRepo)
        {
            _employeeRepo = employeeRepo;
            _attendanceRepo = attendanceRepo;
        }

        // GET /api/stats
        [HttpGet("api/stats")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                long totalEmployees = await _employeeRepo.CountAsync();
                long totalRecords = await _attendanceRepo.CountAsync();

                var (presentToday, lateToday) = await _attendanceRepo.GetTodayStatsAsync();

                long active = await _employeeRepo.CountByStatusAsync("Active");
                long hibernate = await _employeeRepo.CountByStatusAsync("Hibernate");
                long onLeave = await _employeeRepo.CountByStatusAsync("On Leave");
                long resigned = await _employeeRepo.CountByStatusAsync("Resigned");

                long activePercent = totalEmployees > 0 ? (long)Math.Round((double)active / totalEmployees * 100) : 0;
                long hibernatePercent = totalEmployees > 0 ? (long)Math.Round((double)hibernate / totalEmployees * 100) : 0;

                var deptHibernateCounts = await _employeeRepo.GetDeptHibernateCountsAsync();
                var monthlyHibernateTrend = await _employeeRepo.GetMonthlyHibernateTrendsAsync();

                var statusCounts = new
                {
                    active,
                    hibernate,
                    on_leave = onLeave,
                    resigned
                };

                return Ok(new
                {
                    success = true,
                    total_employees = totalEmployees,
                    present_today = presentToday,
                    late_today = lateToday,
                    total_records = totalRecords,
                    status_counts = statusCounts,
                    active_percent = activePercent,
                    hibernate_percent = hibernatePercent,
                    dept_hibernate_counts = deptHibernateCounts,
                    monthly_hibernate_trend = monthlyHibernateTrend
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to compile stats: " + ex.Message });
            }
        }
    }
}
