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

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest req)
        {
            // In production, validate against User table with BCrypt
            if (req.username == "admin" && req.password == "admin123")
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
