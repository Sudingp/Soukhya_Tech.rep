using System.Text.Json.Serialization;

namespace SoukhyaTech.FaceAttendance.Models
{
    public class Employee
    {
        [JsonPropertyName("id")]
        public virtual string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public virtual string Name { get; set; } = string.Empty;

        [JsonPropertyName("department")]
        public virtual string Department { get; set; } = string.Empty;

        [JsonPropertyName("role")]
        public virtual string Role { get; set; } = string.Empty;

        [JsonPropertyName("descriptor")]
        public virtual string Descriptor { get; set; } = string.Empty;

        [JsonPropertyName("image")]
        public virtual string? Image { get; set; }

        [JsonPropertyName("created_at")]
        public virtual string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("status")]
        public virtual string Status { get; set; } = "Active";

        [JsonPropertyName("hibernate_start_date")]
        public virtual string? HibernateStartDate { get; set; }

        [JsonPropertyName("hibernate_end_date")]
        public virtual string? HibernateEndDate { get; set; }

        [JsonPropertyName("hibernate_reason")]
        public virtual string? HibernateReason { get; set; }

        [JsonPropertyName("company")]
        public virtual string? Company { get; set; }

        [JsonPropertyName("designation")]
        public virtual string? Designation { get; set; }

        [JsonPropertyName("gender")]
        public virtual string? Gender { get; set; }

        [JsonPropertyName("date_of_joining")]
        public virtual string? DateOfJoining { get; set; }

        [JsonPropertyName("date_of_confirmation")]
        public virtual string? DateOfConfirmation { get; set; }

        [JsonPropertyName("last_working_day")]
        public virtual string? LastWorkingDay { get; set; }

        [JsonPropertyName("aadhaar_number")]
        public virtual string? AadhaarNumber { get; set; }

        [JsonPropertyName("pan_number")]
        public virtual string? PanNumber { get; set; }

        [JsonPropertyName("card_number")]
        public virtual string? CardNumber { get; set; }

        [JsonPropertyName("phone_no")]
        public virtual string? PhoneNo { get; set; }

        [JsonPropertyName("email")]
        public virtual string? Email { get; set; }

        [JsonPropertyName("reporting_to")]
        public virtual string? ReportingTo { get; set; }

        [JsonPropertyName("device_code")]
        public virtual string? DeviceCode { get; set; }

        [JsonPropertyName("sub_department")]
        public virtual string? SubDepartment { get; set; }

        [JsonPropertyName("division")]
        public virtual string? Division { get; set; }

        [JsonPropertyName("grade")]
        public virtual string? Grade { get; set; }

        [JsonPropertyName("team")]
        public virtual string? Team { get; set; }

        [JsonPropertyName("location")]
        public virtual string? Location { get; set; }

        [JsonPropertyName("employment_type")]
        public virtual string? EmploymentType { get; set; }

        [JsonPropertyName("category")]
        public virtual string? Category { get; set; }

        [JsonPropertyName("holiday_group")]
        public virtual string? HolidayGroup { get; set; }

        [JsonPropertyName("shift_group")]
        public virtual string? ShiftGroup { get; set; }

        [JsonPropertyName("shift_roster")]
        public virtual string? ShiftRoster { get; set; }

        [JsonPropertyName("geofence")]
        public virtual string? Geofence { get; set; }

        [JsonPropertyName("device_expiry_rule_applicable")]
        public virtual int? DeviceExpiryRuleApplicable { get; set; }

        [JsonPropertyName("verification_type")]
        public virtual string? VerificationType { get; set; }

        [JsonPropertyName("expiry_start_date")]
        public virtual string? ExpiryStartDate { get; set; }

        [JsonPropertyName("expiry_end_date")]
        public virtual string? ExpiryEndDate { get; set; }
    }
}
