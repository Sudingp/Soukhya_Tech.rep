using System.Text.Json.Serialization;

namespace SoukhyaTech.FaceAttendance.Models
{
    public class Attendance
    {
        [JsonPropertyName("att_id")]
        public virtual int AttId { get; set; }

        [JsonPropertyName("emp_id")]
        public virtual string EmpId { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public virtual string Name { get; set; } = string.Empty;

        [JsonPropertyName("dept")]
        public virtual string Dept { get; set; } = string.Empty;

        [JsonPropertyName("role")]
        public virtual string Role { get; set; } = string.Empty;

        [JsonPropertyName("timestamp")]
        public virtual string Timestamp { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("status")]
        public virtual string Status { get; set; } = "Present";

        [JsonPropertyName("logged_by")]
        public virtual string? LoggedBy { get; set; }

        [JsonPropertyName("ip_address")]
        public virtual string? IpAddress { get; set; }

        [JsonPropertyName("user_agent")]
        public virtual string? UserAgent { get; set; }
    }
}
