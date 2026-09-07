package com.soukhyatech.faceattendance.controller;

import com.soukhyatech.faceattendance.security.JwtUtil;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record RefreshRequest(@NotBlank String refresh_token) {}

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.username(), req.password())
            );

            String role = auth.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
            String access = jwtUtil.generateAccessToken(req.username(), role);
            String refresh = jwtUtil.generateRefreshToken(req.username());

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("success", true);
            data.put("username", req.username());
            data.put("role", role);
            data.put("access_token", access);
            data.put("refresh_token", refresh);
            return ResponseEntity.ok(data);

        } catch (BadCredentialsException e) {
            return ResponseEntity.status(401).body(error("INVALID_CREDENTIALS", "Invalid username or password"));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refresh(@Valid @RequestBody RefreshRequest req) {
        if (!jwtUtil.validateRefreshToken(req.refresh_token())) {
            return ResponseEntity.status(401).body(error("INVALID_TOKEN", "Invalid or expired refresh token"));
        }

        String username = jwtUtil.parseRefreshClaims(req.refresh_token()).getSubject();
        String access = jwtUtil.generateAccessToken(username, "EMPLOYEE"); // Role re-fetched on next request
        String refresh = jwtUtil.generateRefreshToken(username);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("success", true);
        data.put("access_token", access);
        data.put("refresh_token", refresh);
        return ResponseEntity.ok(data);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@RequestHeader("Authorization") String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwtUtil.blacklistToken(authHeader.substring(7));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Logged out successfully"));
    }

    private Map<String, Object> error(String code, String message) {
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("success", false);
        err.put("error", Map.of("code", code, "message", message));
        return err;
    }
}