using System.Text.Json.Serialization;

namespace SoukhyaTech.FaceAttendance.DTOs
{
    public class AttendanceRequest
    {
        [JsonPropertyName("emp_id")]
        public string? EmpId { get; set; }

        public string? Name { get; set; }

        public string? Dept { get; set; }

        public string? Role { get; set; }

        public string? Timestamp { get; set; }

        public string? Status { get; set; }
    }
}
