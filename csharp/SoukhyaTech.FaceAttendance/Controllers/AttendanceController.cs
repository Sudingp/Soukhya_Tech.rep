using Microsoft.AspNetCore.Mvc;
using SoukhyaTech.FaceAttendance.DTOs;
using SoukhyaTech.FaceAttendance.Models;
using SoukhyaTech.FaceAttendance.Repositories;

namespace SoukhyaTech.FaceAttendance.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AttendanceController : ControllerBase
    {
        private readonly IAttendanceRepository _attendanceRepo;
        private readonly IEmployeeRepository _employeeRepo;

        public AttendanceController(IAttendanceRepository attendanceRepo, IEmployeeRepository employeeRepo)
        {
            _attendanceRepo = attendanceRepo;
            _employeeRepo = employeeRepo;
        }

        // GET /api/attendance?date=YYYY-MM-DD or emp_id=X
        [HttpGet]
        public async Task<IActionResult> GetAttendance([FromQuery] string? date, [FromQuery] string? emp_id)
        {
            try
            {
                List<Attendance> records;
                if (!string.IsNullOrWhiteSpace(date))
                {
                    records = await _attendanceRepo.GetByDateAsync(date);
                }
                else if (!string.IsNullOrWhiteSpace(emp_id))
                {
                    records = await _attendanceRepo.GetByEmpIdAsync(emp_id);
                }
                else
                {
                    records = await _attendanceRepo.GetAllAsync();
                }

                return Ok(new { success = true, records });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to fetch attendance records: " + ex.Message });
            }
        }

        // POST /api/attendance
        [HttpPost]
        public async Task<IActionResult> LogAttendance([FromBody] AttendanceRequest req)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(req.EmpId) ||
                    string.IsNullOrWhiteSpace(req.Name) ||
                    string.IsNullOrWhiteSpace(req.Dept) ||
                    string.IsNullOrWhiteSpace(req.Role))
                {
                    return BadRequest(new { success = false, error = "Missing required fields: emp_id, name, dept, role" });
                }

                // ── ATTENDANCE RULES: Check Hibernate Mode ──
                var emp = await _employeeRepo.GetByIdAsync(req.EmpId);
                if (emp != null && string.Equals(emp.Status, "Hibernate", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, new
                    {
                        success = false,
                        error = "Attendance denied: Employee is currently in Hibernate Mode (leave/sabbatical).",
                        hibernate_reason = emp.HibernateReason,
                        hibernate_start_date = emp.HibernateStartDate,
                        hibernate_end_date = emp.HibernateEndDate
                    });
                }

                // Check duplicate check for today
                bool alreadyLogged = await _attendanceRepo.HasLoggedTodayAsync(req.EmpId);
                if (alreadyLogged)
                {
                    return Conflict(new { success = false, error = "Attendance already logged for today" });
                }

                var record = new Attendance
                {
                    EmpId = req.EmpId,
                    Name = req.Name,
                    Dept = req.Dept,
                    Role = req.Role,
                    Timestamp = !string.IsNullOrWhiteSpace(req.Timestamp) ? req.Timestamp : DateTime.UtcNow.ToString("o"),
                    Status = !string.IsNullOrWhiteSpace(req.Status) ? req.Status : "Present"
                };

                await _attendanceRepo.SaveAsync(record);

                return StatusCode(201, new
                {
                    success = true,
                    message = "Attendance logged successfully",
                    record
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to log attendance: " + ex.Message });
            }
        }

        // DELETE /api/attendance/{att_id}
        [HttpDelete("{att_id:int}")]
        public async Task<IActionResult> Delete(int att_id)
        {
            try
            {
                await _attendanceRepo.DeleteAsync(att_id);
                return Ok(new { success = true, message = "Attendance record deleted" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to delete record: " + ex.Message });
            }
        }
    }
}
