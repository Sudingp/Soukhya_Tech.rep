using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SoukhyaTech.FaceAttendance.DTOs;
using SoukhyaTech.FaceAttendance.Models;
using SoukhyaTech.FaceAttendance.Repositories;

namespace SoukhyaTech.FaceAttendance.Controllers
{
    [ApiController]
    [Route("api/attendance")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly IAttendanceRepository _attRepo;
        private readonly IEmployeeRepository _empRepo;

        public AttendanceController(IAttendanceRepository attRepo, IEmployeeRepository empRepo)
        {
            _attRepo = attRepo; _empRepo = empRepo;
        }

        [HttpGet]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int size = 20, [FromQuery] string? date = null, [FromQuery] string? emp_id = null)
        {
            var records = date != null ? await _attRepo.GetByDateRangeAsync(date + "T00:00:00", date + "T23:59:59.999")
                : emp_id != null ? await _attRepo.GetByEmpIdAsync(emp_id)
                : await _attRepo.GetAllAsync(page, size);
            return Ok(new { success = true, records, pagination = new { page, size } });
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN,HR,DEVICE")]
        public async Task<IActionResult> Create([FromBody] AttendanceRequest req)
        {
            var emp = await _empRepo.GetByIdAsync(req.EmpId!);
            if (emp == null) return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = "Employee not registered" } });
            if (emp.Status == "Hibernate") return StatusCode(403, new { success = false, error = new { code = "FORBIDDEN", message = "Employee currently in Hibernate Mode. Attendance disabled." } });

            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
            if (await _attRepo.HasLoggedTodayAsync(req.EmpId!, today + "T00:00:00", today + "T23:59:59.999"))
                return Ok(new { success = true, message = "Attendance already logged today", duplicate = true });

            var att = new Attendance
            {
                EmpId = req.EmpId!, Name = emp.Name, Dept = emp.Department, Role = emp.Role,
                Timestamp = req.Timestamp!, Status = req.Status!, LoggedBy = User.Identity!.Name,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Request.Headers.UserAgent.ToString()
            };
            await _attRepo.SaveAsync(att);
            return StatusCode(201, new { success = true, message = $"{att.Status} logged for {att.Name}", duplicate = false });
        }

        [HttpDelete("{att_id}")]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<IActionResult> Delete(int att_id)
        {
            await _attRepo.DeleteAsync(att_id);
            return Ok(new { success = true, message = "Record deleted" });
        }
    }
}