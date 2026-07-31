using System.Text.Json.Serialization;

namespace SoukhyaTech.FaceAttendance.DTOs
{
    public class EmployeeRequest
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Department { get; set; }
        public string? Role { get; set; }
        public object? Descriptor { get; set; } // Can be List<float> or string
        public string? Image { get; set; }
        public string? Status { get; set; } = "Active";

        [JsonPropertyName("hibernate_start_date")]
        public string? HibernateStartDate { get; set; }

        [JsonPropertyName("hibernate_end_date")]
        public string? HibernateEndDate { get; set; }

        [JsonPropertyName("hibernate_reason")]
        public string? HibernateReason { get; set; }

        public string? Company { get; set; }
        public string? Designation { get; set; }
        public string? Gender { get; set; }

        [JsonPropertyName("date_of_joining")]
        public string? DateOfJoining { get; set; }

        [JsonPropertyName("date_of_confirmation")]
        public string? DateOfConfirmation { get; set; }

        [JsonPropertyName("last_working_day")]
        public string? LastWorkingDay { get; set; }

        [JsonPropertyName("aadhaar_number")]
        public string? AadhaarNumber { get; set; }

        [JsonPropertyName("pan_number")]
        public string? PanNumber { get; set; }

        [JsonPropertyName("card_number")]
        public string? CardNumber { get; set; }

        [JsonPropertyName("phone_no")]
        public string? PhoneNo { get; set; }

        public string? Email { get; set; }

        [JsonPropertyName("reporting_to")]
        public string? ReportingTo { get; set; }

        [JsonPropertyName("device_code")]
        public string? DeviceCode { get; set; }

        [JsonPropertyName("sub_department")]
        public string? SubDepartment { get; set; }

        public string? Division { get; set; }
        public string? Grade { get; set; }
        public string? Team { get; set; }
        public string? Location { get; set; }

        [JsonPropertyName("employment_type")]
        public string? EmploymentType { get; set; }

        public string? Category { get; set; }

        [JsonPropertyName("holiday_group")]
        public string? HolidayGroup { get; set; }

        [JsonPropertyName("shift_group")]
        public string? ShiftGroup { get; set; }

        [JsonPropertyName("shift_roster")]
        public string? ShiftRoster { get; set; }

        public string? Geofence { get; set; }

        [JsonPropertyName("device_expiry_rule_applicable")]
        public int? DeviceExpiryRuleApplicable { get; set; }

        [JsonPropertyName("verification_type")]
        public string? VerificationType { get; set; }

        [JsonPropertyName("expiry_start_date")]
        public string? ExpiryStartDate { get; set; }

        [JsonPropertyName("expiry_end_date")]
        public string? ExpiryEndDate { get; set; }
    }
}
