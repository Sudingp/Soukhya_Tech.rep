package com.soukhyatech.faceattendance.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app")
public class JwtConfig {

    private Jwt jwt = new Jwt();
    private Encryption encryption = new Encryption();
    private Cors cors = new Cors();
    private RateLimit rateLimit = new RateLimit();

    @Getter
    @Setter
    public static class Jwt {
        private String accessSecret;
        private String refreshSecret;
        private long accessExpiry = 900000;   // 15 minutes
        private long refreshExpiry = 604800000; // 7 days
    }

    @Getter
    @Setter
    public static class Encryption {
        private String piiKey;
    }

    @Getter
    @Setter
    public static class Cors {
        private String allowedOrigins = "http://localhost:3000,http://localhost:5173";

        public String getWhitelist() {
            return allowedOrigins;
        }
    }

    @Getter
    @Setter
    public static class RateLimit {
        private long windowMs = 60000;
        private int maxRequests = 100;
        private int authMax = 10;
    }
}