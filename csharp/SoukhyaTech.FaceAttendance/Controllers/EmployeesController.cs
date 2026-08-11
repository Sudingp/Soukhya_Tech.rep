using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SoukhyaTech.FaceAttendance.DTOs;
using SoukhyaTech.FaceAttendance.Models;
using SoukhyaTech.FaceAttendance.Repositories;
using SoukhyaTech.FaceAttendance.Security;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SoukhyaTech.FaceAttendance.Controllers
{
    [ApiController]
    [Route("api/employees")]
    [Authorize]
    public class EmployeeController : ControllerBase
    {
        private readonly IEmployeeRepository _repo;
        private readonly PiiEncryptionService _crypto;

        public EmployeeController(IEmployeeRepository repo, PiiEncryptionService crypto)
        {
            _repo = repo; _crypto = crypto;
        }

        [HttpGet]
        [Authorize(Roles = "ADMIN,HR,EMPLOYEE")]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            var list = await _repo.GetAllAsync(page, Math.Min(size, 100));
            bool mask = !User.IsInRole("ADMIN") && !User.IsInRole("HR");
            var result = list.Select(e => ToDto(e, mask)).ToList();
            return Ok(new { success = true, employees = result, pagination = new { page, size, total = await _repo.CountAsync() } });
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "ADMIN,HR,EMPLOYEE")]
        public async Task<IActionResult> GetById(string id)
        {
            var emp = await _repo.GetByIdAsync(id);
            if (emp == null) return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = "Employee not found" } });
            bool mask = !User.IsInRole("ADMIN") && !User.IsInRole("HR") && User.Identity!.Name != id;
            return Ok(new { success = true, employee = ToDto(emp, mask) });
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<IActionResult> Create([FromBody] EmployeeRequest req)
        {
            if (await _repo.ExistsAsync(req.Id!)) return Conflict(new { success = false, error = new { code = "CONFLICT", message = "Employee ID already exists" } });
            var emp = new Employee
            {
                Id = req.Id!, Name = req.Name!, Department = req.Department!, Role = req.Role!,
                Descriptor = JsonSerializer.Serialize(req.Descriptor),
                DescriptorHash = Sha256(JsonSerializer.Serialize(req.Descriptor)),
                Image = req.Image, Status = req.Status ?? "Active",
                HibernateStartDate = req.HibernateStartDate, HibernateEndDate = req.HibernateEndDate, HibernateReason = req.HibernateReason,
                AadhaarNumber = req.AadhaarNumber != null ? _crypto.Encrypt(req.AadhaarNumber) : null,
                PanNumber = req.PanNumber != null ? _crypto.Encrypt(req.PanNumber) : null,
                PhoneNo = req.PhoneNo != null ? _crypto.Encrypt(req.PhoneNo) : null,
                Email = req.Email != null ? _crypto.Encrypt(req.Email) : null,
                CardNumber = req.CardNumber != null ? _crypto.Encrypt(req.CardNumber) : null,
                UpdatedBy = User.Identity!.Name
            };
            await _repo.SaveOrUpdateAsync(emp);
            return StatusCode(201, new { success = true, message = "Employee registered successfully", id = emp.Id });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "ADMIN,HR")]
        public async Task<IActionResult> Update(string id, [FromBody] EmployeeRequest req)
        {
            var existing = await _repo.GetByIdAsync(id);
            if (existing == null) return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = "Employee not found" } });
            if (req.Name != null) existing.Name = req.Name;
            if (req.Department != null) existing.Department = req.Department;
            if (req.Role != null) existing.Role = req.Role;
            if (req.Status != null) existing.Status = req.Status;
            if (req.Descriptor != null) { existing.Descriptor = JsonSerializer.Serialize(req.Descriptor); existing.DescriptorHash = Sha256(existing.Descriptor); }
            existing.UpdatedBy = User.Identity!.Name;
            await _repo.SaveOrUpdateAsync(existing);
            return Ok(new { success = true, message = "Employee updated successfully" });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(string id)
        {
            var emp = await _repo.GetByIdAsync(id);
            if (emp == null) return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = "Employee not found" } });
            await _repo.DeleteAsync(emp);
            return Ok(new { success = true, message = "Employee deleted" });
        }

        private object ToDto(Employee e, bool mask)
        {
            return new
            {
                e.Id, e.Name, e.Department, e.Role, e.Status, e.Image, e.CreatedAt, e.UpdatedAt, e.Version,
                hibernate_start_date = e.HibernateStartDate, hibernate_end_date = e.HibernateEndDate, hibernate_reason = e.HibernateReason,
                aadhaar_number = mask ? _crypto.Mask("aadhaar_number", _crypto.Decrypt(e.AadhaarNumber)) : _crypto.Decrypt(e.AadhaarNumber),
                pan_number = mask ? _crypto.Mask("pan_number", _crypto.Decrypt(e.PanNumber)) : _crypto.Decrypt(e.PanNumber),
                phone_no = mask ? _crypto.Mask("phone_no", _crypto.Decrypt(e.PhoneNo)) : _crypto.Decrypt(e.PhoneNo),
                email = mask ? _crypto.Mask("email", _crypto.Decrypt(e.Email)) : _crypto.Decrypt(e.Email),
                card_number = mask ? _crypto.Mask("card_number", _crypto.Decrypt(e.CardNumber)) : _crypto.Decrypt(e.CardNumber),
                e.Company, e.Designation, e.Gender, e.DateOfJoining, e.DateOfConfirmation, e.LastWorkingDay,
                e.ReportingTo, e.DeviceCode, e.SubDepartment, e.Division, e.Grade, e.Team, e.Location,
                e.EmploymentType, e.Category, e.HolidayGroup, e.ShiftGroup, e.ShiftRoster, e.Geofence,
                e.DeviceExpiryRuleApplicable, e.VerificationType, e.ExpiryStartDate, e.ExpiryEndDate
            };
        }

        private static string Sha256(string input)
        {
            return Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
        }
    }
}