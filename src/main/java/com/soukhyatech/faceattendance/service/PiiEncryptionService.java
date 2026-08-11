package com.soukhyatech.faceattendance.service;

import com.soukhyatech.faceattendance.config.JwtConfig;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PiiEncryptionService {

    private final JwtConfig jwtConfig;
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final Set<String> PII_FIELDS = Set.of(
        "aadhaar_number", "pan_number", "phone_no", "email", "card_number"
    );

    private SecretKeySpec keySpec;

    @PostConstruct
    public void init() {
        byte[] keyBytes = jwtConfig.getEncryption().getPiiKey().getBytes(StandardCharsets.UTF_8);
        // Ensure 32 bytes for AES-256
        byte[] key32 = new byte[32];
        System.arraycopy(keyBytes, 0, key32, 0, Math.min(keyBytes.length, 32));
        this.keySpec = new SecretKeySpec(key32, "AES");
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) return null;
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            String ivB64 = Base64.getEncoder().encodeToString(iv);
            String cipherB64 = Base64.getEncoder().encodeToString(encrypted);
            return ivB64 + ":" + cipherB64;
        } catch (Exception e) {
            throw new RuntimeException("PII encryption failed", e);
        }
    }

    public String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isEmpty()) return null;
        try {
            String[] parts = ciphertext.split(":");
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] encrypted = Base64.getDecoder().decode(parts[1]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    public String mask(String field, String value) {
        if (value == null || value.isEmpty()) return null;
        return switch (field) {
            case "aadhaar_number" -> "XXXX-XXXX-" + value.substring(value.lastIndexOf('-') + 1);
            case "pan_number" -> "XXXXX" + value.substring(5, 9) + "X";
            case "phone_no" -> value.substring(0, 4) + " *****-" + value.substring(value.length() - 5);
            case "email" -> {
                int at = value.indexOf('@');
                yield value.charAt(0) + "***@" + value.substring(at + 1);
            }
            case "card_number" -> "****" + value.substring(value.length() - 4);
            default -> value;
        };
    }

    public boolean isPiiField(String field) {
        return PII_FIELDS.contains(field);
    }
}
