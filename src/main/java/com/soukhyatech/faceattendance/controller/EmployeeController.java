package com.soukhyatech.faceattendance.controller;

import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.service.EmployeeService;
import com.soukhyatech.faceattendance.service.PiiEncryptionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;
    private final PiiEncryptionService piiEncryptionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','HR','EMPLOYEE')")
    public ResponseEntity<Map<String, Object>> getAll(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        boolean isAdminOrHr = auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_HR"));
        String selfId = auth.getName();

        List<Employee> employees = employeeService.getAll(page, Math.min(size, 100));
        List<Map<String, Object>> list = employees.stream().map(e -> {
            employeeService.decryptPii(e, !isAdminOrHr && !e.getId().equals(selfId));
            return toDto(e);
        }).collect(Collectors.toList());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("employees", list);
        res.put("pagination", Map.of("page", page, "size", size, "total", employeeService.count()));
        return ResponseEntity.ok(res);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','HR','EMPLOYEE')")
    public ResponseEntity<Map<String, Object>> getById(
            @PathVariable String id, Authentication auth) {

        boolean isAdminOrHr = auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_HR"));
        Employee emp = employeeService.getById(id)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found"));
        employeeService.decryptPii(emp, !isAdminOrHr && !emp.getId().equals(auth.getName()));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("employee", toDto(emp));
        return ResponseEntity.ok(res);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<Map<String, Object>> create(
            @Valid @RequestBody Employee emp, Authentication auth, HttpServletRequest req) {
        Employee saved = employeeService.create(emp, auth.getName(), req);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", "Employee registered successfully");
        res.put("id", saved.getId());
        return ResponseEntity.status(201).body(res);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable String id,
            @RequestBody Employee updates,
            @RequestParam int version,
            Authentication auth, HttpServletRequest req) {
        Employee saved = employeeService.update(id, updates, version, auth.getName(), req);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", "Employee updated successfully");
        res.put("version", saved.getVersion());
        return ResponseEntity.ok(res);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> delete(
            @PathVariable String id, Authentication auth, HttpServletRequest req) {
        employeeService.delete(id, auth.getName(), req);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", "Employee deleted");
        return ResponseEntity.ok(res);
    }

    private Map<String, Object> toDto(Employee e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId());
        m.put("name", e.getName());
        m.put("department", e.getDepartment());
        m.put("role", e.getRole());
        m.put("status", e.getStatus());
        m.put("image", e.getImage());
        m.put("created_at", e.getCreatedAt());
        m.put("updated_at", e.getUpdatedAt());
        m.put("version", e.getVersion());
        m.put("hibernate_start_date", e.getHibernateStartDate());
        m.put("hibernate_end_date", e.getHibernateEndDate());
        m.put("hibernate_reason", e.getHibernateReason());
        m.put("company", e.getCompany());
        m.put("designation", e.getDesignation());
        m.put("gender", e.getGender());
        m.put("date_of_joining", e.getDateOfJoining());
        m.put("date_of_confirmation", e.getDateOfConfirmation());
        m.put("last_working_day", e.getLastWorkingDay());
        m.put("aadhaar_number", e.getAadhaarNumber());
        m.put("pan_number", e.getPanNumber());
        m.put("card_number", e.getCardNumber());
        m.put("phone_no", e.getPhoneNo());
        m.put("email", e.getEmail());
        m.put("reporting_to", e.getReportingTo());
        m.put("device_code", e.getDeviceCode());
        m.put("sub_department", e.getSubDepartment());
        m.put("division", e.getDivision());
        m.put("grade", e.getGrade());
        m.put("team", e.getTeam());
        m.put("location", e.getLocation());
        m.put("employment_type", e.getEmploymentType());
        m.put("category", e.getCategory());
        m.put("holiday_group", e.getHolidayGroup());
        m.put("shift_group", e.getShiftGroup());
        m.put("shift_roster", e.getShiftRoster());
        m.put("geofence", e.getGeofence());
        m.put("device_expiry_rule_applicable", e.getDeviceExpiryRuleApplicable());
        m.put("verification_type", e.getVerificationType());
        m.put("expiry_start_date", e.getExpiryStartDate());
        m.put("expiry_end_date", e.getExpiryEndDate());
        return m;
    }
}
