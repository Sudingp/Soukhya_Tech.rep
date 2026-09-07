package com.soukhyatech.faceattendance.controller;

import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.service.AttendanceService;
import com.soukhyatech.faceattendance.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final EmployeeService employeeService;
    private final AttendanceService attendanceService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<Map<String, Object>> getStats() {
        long totalEmployees = employeeService.count();
        long totalRecords = attendanceService.count();
        var today = attendanceService.getTodayStats();
        long active = employeeService.countByStatus(Employee.Status.Active);
        long hibernate = employeeService.countByStatus(Employee.Status.Hibernate);
        long onLeave = employeeService.countByStatus(Employee.Status.On_Leave);
        long resigned = employeeService.countByStatus(Employee.Status.Resigned);

        long activePercent = totalEmployees > 0 ? Math.round((double) active / totalEmployees * 100) : 0;
        long hibernatePercent = totalEmployees > 0 ? Math.round((double) hibernate / totalEmployees * 100) : 0;

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("total_employees", totalEmployees);
        res.put("present_today", today.getPresentToday());
        res.put("late_today", today.getLateToday());
        res.put("total_records", totalRecords);
        res.put("status_counts", Map.of(
            "active", active,
            "hibernate", hibernate,
            "on_leave", onLeave,
            "resigned", resigned
        ));
        res.put("active_percent", activePercent);
        res.put("hibernate_percent", hibernatePercent);
        res.put("dept_hibernate_counts", employeeService.getDeptHibernateCounts());
        res.put("monthly_hibernate_trend", employeeService.getMonthlyHibernateTrends());
        return ResponseEntity.ok(res);
    }
}
