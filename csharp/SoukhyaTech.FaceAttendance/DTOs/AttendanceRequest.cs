using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SoukhyaTech.FaceAttendance.DTOs
{
    public class AttendanceRequest
    {
        [Required]
        [JsonPropertyName("emp_id")]
        public string? EmpId { get; set; }

        [Required, StringLength(100, MinimumLength = 2)]
        public string? Name { get; set; }

        [Required]
        public string? Dept { get; set; }

        [Required]
        public string? Role { get; set; }

        [Required]
        public string? Timestamp { get; set; }

        [Required, RegularExpression(@"^(Present|Late)$")]
        public string? Status { get; set; }
    }
}
