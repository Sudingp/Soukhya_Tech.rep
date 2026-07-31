using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SoukhyaTech.FaceAttendance.DTOs;
using SoukhyaTech.FaceAttendance.Models;
using SoukhyaTech.FaceAttendance.Repositories;

namespace SoukhyaTech.FaceAttendance.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmployeesController : ControllerBase
    {
        private readonly IEmployeeRepository _employeeRepo;

        public EmployeesController(IEmployeeRepository employeeRepo)
        {
            _employeeRepo = employeeRepo;
        }

        // GET /api/employees
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var employees = await _employeeRepo.GetAllAsync();
                return Ok(new { success = true, employees });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to fetch employees: " + ex.Message });
            }
        }

        // GET /api/employees/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            try
            {
                var emp = await _employeeRepo.GetByIdAsync(id);
                if (emp == null)
                {
                    return NotFound(new { success = false, error = "Employee not found" });
                }
                return Ok(new { success = true, employee = emp });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to fetch employee: " + ex.Message });
            }
        }

        // POST /api/employees
        [HttpPost]
        public async Task<IActionResult> Register([FromBody] EmployeeRequest req)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(req.Id) ||
                    string.IsNullOrWhiteSpace(req.Name) ||
                    string.IsNullOrWhiteSpace(req.Department) ||
                    string.IsNullOrWhiteSpace(req.Role) ||
                    req.Descriptor == null)
                {
                    return BadRequest(new { success = false, error = "Missing required fields: id, name, department, role, descriptor" });
                }

                if (await _employeeRepo.ExistsAsync(req.Id))
                {
                    return Conflict(new { success = false, error = $"Employee ID \"{req.Id}\" already exists" });
                }

                string descriptorJson = ExtractDescriptorJson(req.Descriptor);

                var emp = new Employee
                {
                    Id = req.Id,
                    Name = req.Name,
                    Department = req.Department,
                    Role = req.Role,
                    Descriptor = descriptorJson,
                    Image = req.Image,
                    Status = req.Status ?? "Active",
                    CreatedAt = DateTime.UtcNow.ToString("o"),

                    // Hibernate Mode Fields
                    HibernateStartDate = req.HibernateStartDate,
                    HibernateEndDate = req.HibernateEndDate,
                    HibernateReason = req.HibernateReason,

                    // Enterprise Info
                    Company = req.Company,
                    Designation = req.Designation,
                    Gender = req.Gender,
                    DateOfJoining = req.DateOfJoining,
                    DateOfConfirmation = req.DateOfConfirmation,
                    LastWorkingDay = req.LastWorkingDay,
                    AadhaarNumber = req.AadhaarNumber,
                    PanNumber = req.PanNumber,
                    CardNumber = req.CardNumber,
                    PhoneNo = req.PhoneNo,
                    Email = req.Email,
                    ReportingTo = req.ReportingTo,
                    DeviceCode = req.DeviceCode,
                    SubDepartment = req.SubDepartment,
                    Division = req.Division,
                    Grade = req.Grade,
                    Team = req.Team,
                    Location = req.Location,
                    EmploymentType = req.EmploymentType,
                    Category = req.Category,
                    HolidayGroup = req.HolidayGroup,
                    ShiftGroup = req.ShiftGroup,
                    ShiftRoster = req.ShiftRoster,
                    Geofence = req.Geofence,
                    DeviceExpiryRuleApplicable = req.DeviceExpiryRuleApplicable,
                    VerificationType = req.VerificationType,
                    ExpiryStartDate = req.ExpiryStartDate,
                    ExpiryEndDate = req.ExpiryEndDate
                };

                await _employeeRepo.SaveOrUpdateAsync(emp);

                return StatusCode(201, new
                {
                    success = true,
                    message = "Employee registered successfully",
                    employee = emp
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to register employee: " + ex.Message });
            }
        }

        // PUT /api/employees/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] EmployeeRequest req)
        {
            try
            {
                var emp = await _employeeRepo.GetByIdAsync(id);
                if (emp == null)
                {
                    return NotFound(new { success = false, error = "Employee not found" });
                }

                if (!string.IsNullOrWhiteSpace(req.Name)) emp.Name = req.Name;
                if (!string.IsNullOrWhiteSpace(req.Department)) emp.Department = req.Department;
                if (!string.IsNullOrWhiteSpace(req.Role)) emp.Role = req.Role;
                if (req.Descriptor != null) emp.Descriptor = ExtractDescriptorJson(req.Descriptor);
                if (req.Image != null) emp.Image = req.Image;
                if (req.Status != null) emp.Status = req.Status;

                // Hibernate Mode Update
                emp.HibernateStartDate = req.HibernateStartDate ?? emp.HibernateStartDate;
                emp.HibernateEndDate = req.HibernateEndDate ?? emp.HibernateEndDate;
                emp.HibernateReason = req.HibernateReason ?? emp.HibernateReason;

                // HR Info Updates
                if (req.Company != null) emp.Company = req.Company;
                if (req.Designation != null) emp.Designation = req.Designation;
                if (req.Gender != null) emp.Gender = req.Gender;
                if (req.DateOfJoining != null) emp.DateOfJoining = req.DateOfJoining;
                if (req.DateOfConfirmation != null) emp.DateOfConfirmation = req.DateOfConfirmation;
                if (req.LastWorkingDay != null) emp.LastWorkingDay = req.LastWorkingDay;
                if (req.AadhaarNumber != null) emp.AadhaarNumber = req.AadhaarNumber;
                if (req.PanNumber != null) emp.PanNumber = req.PanNumber;
                if (req.CardNumber != null) emp.CardNumber = req.CardNumber;
                if (req.PhoneNo != null) emp.PhoneNo = req.PhoneNo;
                if (req.Email != null) emp.Email = req.Email;
                if (req.ReportingTo != null) emp.ReportingTo = req.ReportingTo;
                if (req.DeviceCode != null) emp.DeviceCode = req.DeviceCode;
                if (req.SubDepartment != null) emp.SubDepartment = req.SubDepartment;
                if (req.Division != null) emp.Division = req.Division;
                if (req.Grade != null) emp.Grade = req.Grade;
                if (req.Team != null) emp.Team = req.Team;
                if (req.Location != null) emp.Location = req.Location;
                if (req.EmploymentType != null) emp.EmploymentType = req.EmploymentType;
                if (req.Category != null) emp.Category = req.Category;
                if (req.HolidayGroup != null) emp.HolidayGroup = req.HolidayGroup;
                if (req.ShiftGroup != null) emp.ShiftGroup = req.ShiftGroup;
                if (req.ShiftRoster != null) emp.ShiftRoster = req.ShiftRoster;
                if (req.Geofence != null) emp.Geofence = req.Geofence;
                if (req.DeviceExpiryRuleApplicable.HasValue) emp.DeviceExpiryRuleApplicable = req.DeviceExpiryRuleApplicable;
                if (req.VerificationType != null) emp.VerificationType = req.VerificationType;
                if (req.ExpiryStartDate != null) emp.ExpiryStartDate = req.ExpiryStartDate;
                if (req.ExpiryEndDate != null) emp.ExpiryEndDate = req.ExpiryEndDate;

                await _employeeRepo.SaveOrUpdateAsync(emp);

                return Ok(new
                {
                    success = true,
                    message = "Employee updated successfully",
                    employee = emp
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to update employee: " + ex.Message });
            }
        }

        // DELETE /api/employees/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            try
            {
                var emp = await _employeeRepo.GetByIdAsync(id);
                if (emp == null)
                {
                    return NotFound(new { success = false, error = "Employee not found" });
                }

                await _employeeRepo.DeleteAsync(emp);
                return Ok(new { success = true, message = $"Employee \"{id}\" deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to delete employee: " + ex.Message });
            }
        }

        private static string ExtractDescriptorJson(object descriptor)
        {
            if (descriptor is JsonElement elem)
            {
                return elem.GetRawText();
            }
            if (descriptor is string str)
            {
                return str;
            }
            return JsonSerializer.Serialize(descriptor);
        }
    }
}
