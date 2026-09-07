package com.soukhyatech.faceattendance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.soukhyatech.faceattendance.model.AuditLog;
import com.soukhyatech.faceattendance.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @SneakyThrows
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String table, String recordId, AuditLog.Action action,
                    Object oldVals, Object newVals, String performedBy,
                    HttpServletRequest request) {
        try {
            AuditLog log = AuditLog.builder()
                .tableName(table)
                .recordId(recordId)
                .action(action)
                .oldValues(oldVals != null ? objectMapper.writeValueAsString(oldVals) : null)
                .newValues(newVals != null ? objectMapper.writeValueAsString(newVals) : null)
                .performedBy(performedBy != null ? performedBy : "anonymous")
                .ipAddress(request != null ? request.getRemoteAddr() : null)
                .userAgent(request != null ? request.getHeader("User-Agent") : null)
                .build();
            auditLogRepository.save(log);
        } catch (Exception e) {
            // Audit failure must not break business transaction
            System.err.println("[AUDIT] Failed: " + e.getMessage());
        }
    }
}
