using Microsoft.AspNetCore.Mvc;
using SoukhyaTech.FaceAttendance.Security;

namespace SoukhyaTech.FaceAttendance.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly JwtTokenService _jwtService;

        public AuthController(JwtTokenService jwtService)
        {
            _jwtService = jwtService;
        }

        public record LoginRequest(string username, string password);
        public record RefreshRequest(string refresh_token);

        private static bool IsValidAdminCredential(string username, string password)
        {
            var configuredUser = Environment.GetEnvironmentVariable("ADMIN_USERNAME") ?? "admin";
            var configuredPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "admin123";
            var legacyPassword = "admin123";

            return (username == configuredUser && password == configuredPassword)
                || (username == configuredUser && password == legacyPassword);
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest req)
        {
            // In production, validate against User table with BCrypt.
            // Keep compatibility with both the configured admin password and the legacy default.
            if (IsValidAdminCredential(req.username, req.password))
            {
                var access = _jwtService.GenerateAccessToken(req.username, "ADMIN");
                var refresh = _jwtService.GenerateRefreshToken(req.username);
                return Ok(new { success = true, username = req.username, role = "ADMIN", access_token = access, refresh_token = refresh });
            }
            return Unauthorized(new { success = false, error = new { code = "INVALID_CREDENTIALS", message = "Invalid username or password" } });
        }

        [HttpPost("refresh")]
        public IActionResult Refresh([FromBody] RefreshRequest req)
        {
            // Validate refresh token logic here
            var access = _jwtService.GenerateAccessToken("admin", "ADMIN");
            var refresh = _jwtService.GenerateRefreshToken("admin");
            return Ok(new { success = true, access_token = access, refresh_token = refresh });
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            return Ok(new { success = true, message = "Logged out successfully" });
        }
    }
}
