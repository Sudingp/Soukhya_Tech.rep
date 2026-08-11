using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SoukhyaTech.FaceAttendance.Repositories;

namespace SoukhyaTech.FaceAttendance.Controllers
{
    [ApiController]
    [Route("api/stats")]
    [Authorize(Roles = "ADMIN,HR")]
    public class StatsController : ControllerBase
    {
        private readonly IEmployeeRepository _employeeRepo;
        private readonly IAttendanceRepository _attendanceRepo;

        public StatsController(IEmployeeRepository employeeRepo, IAttendanceRepository attendanceRepo)
        {
            _employeeRepo = employeeRepo; _attendanceRepo = attendanceRepo;
        }

        [HttpGet]
        public async Task<IActionResult> GetStats()
        {
            long totalEmployees = await _employeeRepo.CountAsync();
            long totalRecords = await _attendanceRepo.CountAsync();
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var (presentToday, lateToday) = await _attendanceRepo.GetTodayStatsAsync(today + "T00:00:00", today + "T23:59:59.999");
            long active = await _employeeRepo.CountByStatusAsync("Active");
            long hibernate = await _employeeRepo.CountByStatusAsync("Hibernate");
            long onLeave = await _employeeRepo.CountByStatusAsync("On Leave");
            long resigned = await _employeeRepo.CountByStatusAsync("Resigned");

            return Ok(new
            {
                success = true,
                total_employees = totalEmployees,
                present_today = presentToday,
                late_today = lateToday,
                total_records = totalRecords,
                status_counts = new { active, hibernate, on_leave = onLeave, resigned },
                active_percent = totalEmployees > 0 ? Math.Round((double)active / totalEmployees * 100) : 0,
                hibernate_percent = totalEmployees > 0 ? Math.Round((double)hibernate / totalEmployees * 100) : 0,
                dept_hibernate_counts = await _employeeRepo.GetDeptHibernateCountsAsync(),
                monthly_hibernate_trend = await _employeeRepo.GetMonthlyHibernateTrendsAsync()
            });
        }
    }
}