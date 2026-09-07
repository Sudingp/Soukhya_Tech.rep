package com.soukhyatech.faceattendance.security;

import com.soukhyatech.faceattendance.config.JwtConfig;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class JwtUtil {

    private final JwtConfig jwtConfig;

    private javax.crypto.SecretKey accessKey;
    private javax.crypto.SecretKey refreshKey;

    // Token blacklist: SHA-256 hash → expiry epoch seconds
    private static final ConcurrentHashMap<String, Long> BLACKLIST = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        this.accessKey = Keys.hmacShaKeyFor(jwtConfig.getJwt().getAccessSecret().getBytes(StandardCharsets.UTF_8));
        this.refreshKey = Keys.hmacShaKeyFor(jwtConfig.getJwt().getRefreshSecret().getBytes(StandardCharsets.UTF_8));
    }

    // ── Token Generation ──
    public String generateAccessToken(String username, String role) {
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .claim("type", "access")
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusMillis(jwtConfig.getJwt().getAccessExpiry())))
                .id(java.util.UUID.randomUUID().toString())
                .signWith(accessKey, Jwts.SIG.HS256)
                .compact();
    }

    public String generateRefreshToken(String username) {
        return Jwts.builder()
                .subject(username)
                .claim("type", "refresh")
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusMillis(jwtConfig.getJwt().getRefreshExpiry())))
                .id(java.util.UUID.randomUUID().toString())
                .signWith(refreshKey, Jwts.SIG.HS256)
                .compact();
    }

    // ── Validation ──
    public boolean validateAccessToken(String token) {
        try {
            if (isBlacklisted(token)) return false;
            Jwts.parser().verifyWith(accessKey).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public boolean validateRefreshToken(String token) {
        try {
            Jwts.parser().verifyWith(refreshKey).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Claims parseAccessClaims(String token) {
        return Jwts.parser().verifyWith(accessKey).build().parseSignedClaims(token).getPayload();
    }

    public Claims parseRefreshClaims(String token) {
        return Jwts.parser().verifyWith(refreshKey).build().parseSignedClaims(token).getPayload();
    }

    public String extractUsername(String token) {
        return parseAccessClaims(token).getSubject();
    }

    public String extractRole(String token) {
        return parseAccessClaims(token).get("role", String.class);
    }

    // ── Blacklist ──
    public void blacklistToken(String token) {
        try {
            Claims claims = parseAccessClaims(token);
            long exp = claims.getExpiration().toInstant().getEpochSecond();
            BLACKLIST.put(sha256(token), exp);
        } catch (Exception ignored) {}
    }

    public boolean isBlacklisted(String token) {
        purgeExpired();
        return BLACKLIST.containsKey(sha256(token));
    }

    private void purgeExpired() {
        long now = Instant.now().getEpochSecond();
        BLACKLIST.entrySet().removeIf(e -> e.getValue() < now);
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ── HMAC Request Signature ──
    public boolean verifyRequestSignature(String method, String path, String body, String timestamp, String signature) {
        try {
            long ts = Long.parseLong(timestamp);
            long now = System.currentTimeMillis();
            if (Math.abs(now - ts) > 5 * 60 * 1000) return false;

            String payload = method.toUpperCase() + "|" + path + "|" + timestamp + "|" + (body == null ? "{}" : body);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(accessKey.getEncoded(), "HmacSHA256"));
            String expected = Base64.getEncoder().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));

            return MessageDigest.isEqual(
                    signature.getBytes(StandardCharsets.UTF_8),
                    expected.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            return false;
        }
    }

    public String signRequest(String method, String path, String body, String timestamp) {
        try {
            String payload = method.toUpperCase() + "|" + path + "|" + timestamp + "|" + (body == null ? "{}" : body);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(accessKey.getEncoded(), "HmacSHA256"));
            return Base64.getEncoder().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}