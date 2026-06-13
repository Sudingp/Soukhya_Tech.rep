package com.soukhyatech.faceattendance.controller;

import com.soukhyatech.faceattendance.repository.AttendanceRepository;
import com.soukhyatech.faceattendance.repository.EmployeeRepository;
import com.soukhyatech.faceattendance.service.SeederService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@CrossOrigin
public class StatsController {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private SeederService seederService;

    // Utility response helpers
    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> data) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.putAll(data);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> err(String msg, HttpStatus status) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("error", msg);
        return ResponseEntity.status(status).body(response);
    }

    // GET /api/stats — Get dashboard summary metrics and hibernate analytics
    @GetMapping("/api/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        try {
            long totalEmployees = employeeRepository.count();
            long totalRecords = attendanceRepository.count();

            // Fetch today's log statistics
            Map<String, Object> todayStats = attendanceRepository.getStatsToday();
            Object presentObj = todayStats != null ? todayStats.get("present_today") : null;
            Object lateObj = todayStats != null ? todayStats.get("late_today") : null;

            long presentToday = presentObj instanceof Number ? ((Number) presentObj).longValue() : 0;
            long lateToday = lateObj instanceof Number ? ((Number) lateObj).longValue() : 0;

            // Fetch employee status totals
            long active = employeeRepository.countByStatus("Active");
            long hibernate = employeeRepository.countByStatus("Hibernate");
            long onLeave = employeeRepository.countByStatus("On Leave");
            long resigned = employeeRepository.countByStatus("Resigned");

            // Calculate ratios
            long activePercent = totalEmployees > 0 ? Math.round((double) active / totalEmployees * 100) : 0;
            long hibernatePercent = totalEmployees > 0 ? Math.round((double) hibernate / totalEmployees * 100) : 0;

            // Retrieve aggregates for Chart.js
            List<Map<String, Object>> deptHibernateCounts = employeeRepository.getDeptHibernateCounts();
            List<Map<String, Object>> monthlyHibernateTrend = employeeRepository.getMonthlyHibernateTrends();

            // Build payload
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("total_employees", totalEmployees);
            data.put("present_today", presentToday);
            data.put("late_today", lateToday);
            data.put("total_records", totalRecords);

            Map<String, Object> statusCounts = new HashMap<>();
            statusCounts.put("active", active);
            statusCounts.put("hibernate", hibernate);
            statusCounts.put("on_leave", onLeave);
            statusCounts.put("resigned", resigned);
            data.put("status_counts", statusCounts);

            data.put("active_percent", activePercent);
            data.put("hibernate_percent", hibernatePercent);
            data.put("dept_hibernate_counts", deptHibernateCounts);
            data.put("monthly_hibernate_trend", monthlyHibernateTrend);

            return ok(data);

        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to compile dashboard statistics", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // POST /api/reset-seed — Clean and re-seed database
    @PostMapping("/api/reset-seed")
    public ResponseEntity<Map<String, Object>> resetAndSeed() {
        try {
            seederService.resetAndSeed();
            
            Map<String, Object> data = new HashMap<>();
            data.put("message", "Database has been reset and seeded with 100 realistic records!");
            return ok(data);
        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to reset and seed database: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
