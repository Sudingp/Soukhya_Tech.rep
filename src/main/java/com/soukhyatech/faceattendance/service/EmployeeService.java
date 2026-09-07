package com.soukhyatech.faceattendance.service;

import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.model.AuditLog;
import com.soukhyatech.faceattendance.repository.EmployeeRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final PiiEncryptionService piiEncryptionService;
    private final AuditLogService auditLogService;

    @Cacheable(value = "employees", key = "#id")
    @Transactional(readOnly = true)
    public Optional<Employee> getById(String id) {
        return employeeRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Employee> getAll(int page, int size) {
        return employeeRepository.findAll(PageRequest.of(page - 1, size)).getContent();
    }

    @Transactional(readOnly = true)
    public List<Employee> getAll() {
        return employeeRepository.findAllByOrderByCreatedAtDesc();
    }

    @CacheEvict(value = "employees", allEntries = true)
    @Transactional
    public Employee create(Employee emp, String updatedBy, HttpServletRequest req) {
        if (employeeRepository.existsById(emp.getId())) {
            throw new IllegalArgumentException("Employee ID already exists");
        }
        emp.setDescriptorHash(computeDescriptorHash(emp.getDescriptor()));
        emp.setUpdatedBy(updatedBy);
        encryptPii(emp);
        Employee saved = employeeRepository.save(emp);
        auditLogService.log("employees", saved.getId(), AuditLog.Action.INSERT,
            null, Map.of("name", saved.getName(), "department", saved.getDepartment()),
            updatedBy, req);
        return saved;
    }

    @CacheEvict(value = "employees", key = "#id")
    @Transactional
    public Employee update(String id, Employee updates, int version, String updatedBy, HttpServletRequest req) {
        Employee existing = employeeRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found"));

        if (!existing.getVersion().equals(version)) {
            throw new IllegalStateException("Optimistic locking conflict. Please refresh and retry.");
        }

        Map<String, Object> oldVals = Map.of(
            "name", existing.getName(),
            "department", existing.getDepartment(),
            "role", existing.getRole(),
            "status", existing.getStatus()
        );

        if (updates.getName() != null) existing.setName(updates.getName());
        if (updates.getDepartment() != null) existing.setDepartment(updates.getDepartment());
        if (updates.getRole() != null) existing.setRole(updates.getRole());
        if (updates.getImage() != null) existing.setImage(updates.getImage());
        if (updates.getStatus() != null) existing.setStatus(updates.getStatus());
        if (updates.getDescriptor() != null) {
            existing.setDescriptor(updates.getDescriptor());
            existing.setDescriptorHash(computeDescriptorHash(updates.getDescriptor()));
        }
        if (updates.getHibernateStartDate() != null) existing.setHibernateStartDate(updates.getHibernateStartDate());
        if (updates.getHibernateEndDate() != null) existing.setHibernateEndDate(updates.getHibernateEndDate());
        if (updates.getHibernateReason() != null) existing.setHibernateReason(updates.getHibernateReason());

        // PII fields
        if (updates.getAadhaarNumber() != null) existing.setAadhaarNumber(updates.getAadhaarNumber());
        if (updates.getPanNumber() != null) existing.setPanNumber(updates.getPanNumber());
        if (updates.getPhoneNo() != null) existing.setPhoneNo(updates.getPhoneNo());
        if (updates.getEmail() != null) existing.setEmail(updates.getEmail());
        if (updates.getCardNumber() != null) existing.setCardNumber(updates.getCardNumber());

        existing.setUpdatedBy(updatedBy);
        encryptPii(existing);
        Employee saved = employeeRepository.save(existing);

        auditLogService.log("employees", id, AuditLog.Action.UPDATE,
            oldVals, Map.of("name", saved.getName(), "department", saved.getDepartment(), "status", saved.getStatus()),
            updatedBy, req);
        return saved;
    }

    @CacheEvict(value = "employees", allEntries = true)
    @Transactional
    public void delete(String id, String deletedBy, HttpServletRequest req) {
        Employee existing = employeeRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found"));
        employeeRepository.deleteById(id);
        auditLogService.log("employees", id, AuditLog.Action.DELETE,
            Map.of("name", existing.getName()), null, deletedBy, req);
    }

    @Transactional(readOnly = true)
    public long count() {
        return employeeRepository.count();
    }

    @Transactional(readOnly = true)
    public long countByStatus(Employee.Status status) {
        return employeeRepository.countByStatus(status);
    }

    @Transactional(readOnly = true)
    public List<EmployeeRepository.DeptHibernateCount> getDeptHibernateCounts() {
        return employeeRepository.getDeptHibernateCounts();
    }

    @Transactional(readOnly = true)
    public List<EmployeeRepository.MonthlyHibernateTrend> getMonthlyHibernateTrends() {
        return employeeRepository.getMonthlyHibernateTrends();
    }

    // PII helpers
    public void encryptPii(Employee emp) {
        if (emp.getAadhaarNumber() != null) emp.setAadhaarNumber(piiEncryptionService.encrypt(emp.getAadhaarNumber()));
        if (emp.getPanNumber() != null) emp.setPanNumber(piiEncryptionService.encrypt(emp.getPanNumber()));
        if (emp.getPhoneNo() != null) emp.setPhoneNo(piiEncryptionService.encrypt(emp.getPhoneNo()));
        if (emp.getEmail() != null) emp.setEmail(piiEncryptionService.encrypt(emp.getEmail()));
        if (emp.getCardNumber() != null) emp.setCardNumber(piiEncryptionService.encrypt(emp.getCardNumber()));
    }

    public void decryptPii(Employee emp, boolean mask) {
        emp.setAadhaarNumber(processPii("aadhaar_number", emp.getAadhaarNumber(), mask));
        emp.setPanNumber(processPii("pan_number", emp.getPanNumber(), mask));
        emp.setPhoneNo(processPii("phone_no", emp.getPhoneNo(), mask));
        emp.setEmail(processPii("email", emp.getEmail(), mask));
        emp.setCardNumber(processPii("card_number", emp.getCardNumber(), mask));
    }

    private String processPii(String field, String value, boolean mask) {
        if (value == null) return null;
        String decrypted = piiEncryptionService.decrypt(value);
        if (decrypted == null) decrypted = value; // fallback for plaintext legacy
        return mask ? piiEncryptionService.mask(field, decrypted) : decrypted;
    }

    private String computeDescriptorHash(String descriptorJson) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(descriptorJson.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    public boolean isHibernateActive(Employee emp) {
        if (emp.getStatus() != Employee.Status.Hibernate) return false;
        if (emp.getHibernateStartDate() == null || emp.getHibernateEndDate() == null) return true;
        LocalDate today = LocalDate.now();
        LocalDate start = LocalDate.parse(emp.getHibernateStartDate(), DateTimeFormatter.ISO_LOCAL_DATE);
        LocalDate end = LocalDate.parse(emp.getHibernateEndDate(), DateTimeFormatter.ISO_LOCAL_DATE);
        return !today.isBefore(start) && !today.isAfter(end);
    }
}
