package com.soukhyatech.faceattendance.controller;

import com.soukhyatech.faceattendance.model.Attendance;
import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.repository.AttendanceRepository;
import com.soukhyatech.faceattendance.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/attendance")
@CrossOrigin
public class AttendanceController {

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    // Utility response helpers
    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> data) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.putAll(data);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> data, HttpStatus status) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.putAll(data);
        return ResponseEntity.status(status).body(response);
    }

    private ResponseEntity<Map<String, Object>> err(String msg, HttpStatus status) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("error", msg);
        return ResponseEntity.status(status).body(response);
    }

    // GET /api/attendance — List all records (supports ?date=YYYY-MM-DD or ?emp_id=...)
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAttendance(
            @RequestParam(value = "date", required = false) String date,
            @RequestParam(value = "emp_id", required = false) String empId) {
        try {
            List<Attendance> records;
            if (date != null && !date.trim().isEmpty()) {
                records = attendanceRepository.getAttByDate(date);
            } else if (empId != null && !empId.trim().isEmpty()) {
                records = attendanceRepository.findByEmpIdOrderByTimestampDesc(empId);
            } else {
                records = attendanceRepository.findAllByOrderByTimestampDesc();
            }

            Map<String, Object> data = new HashMap<>();
            data.put("records", records);
            return ok(data);
        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to fetch attendance logs", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // POST /api/attendance — Log attendance
    @PostMapping
    public ResponseEntity<Map<String, Object>> logAttendance(@RequestBody AttendanceRequest req) {
        try {
            if (req.emp_id == null || req.name == null || req.dept == null || req.role == null || req.timestamp == null || req.status == null) {
                return err("Missing required fields", HttpStatus.BAD_REQUEST);
            }

            if (!Arrays.asList("Present", "Late").contains(req.status)) {
                return err("status must be \"Present\" or \"Late\"", HttpStatus.BAD_REQUEST);
            }

            // ── CRITICAL: Check Hibernate Status Guard ──
            Optional<Employee> empOpt = employeeRepository.findById(req.emp_id);
            if (empOpt.isEmpty()) {
                return err("Employee not registered in the system", HttpStatus.NOT_FOUND);
            }

            Employee emp = empOpt.get();
            if ("Hibernate".equals(emp.getStatus())) {
                return err("Employee currently in Hibernate Mode. Attendance disabled.", HttpStatus.FORBIDDEN); // 403
            }

            // Duplicate check — one record per employee per calendar day
            List<Attendance> dupList = attendanceRepository.checkDuplicateToday(req.emp_id);
            if (!dupList.isEmpty()) {
                Attendance dup = dupList.get(0);
                Map<String, Object> dupResponse = new HashMap<>();
                dupResponse.put("message", "Attendance already logged today");
                dupResponse.put("duplicate", true);
                dupResponse.put("att_id", dup.getAttId());
                return ok(dupResponse);
            }

            // Save new log
            Attendance att = Attendance.builder()
                    .empId(req.emp_id)
                    .name(req.name)
                    .dept(req.dept)
                    .role(req.role)
                    .timestamp(req.timestamp)
                    .status(req.status)
                    .build();

            attendanceRepository.save(att);

            Map<String, Object> data = new HashMap<>();
            data.put("message", req.status + " logged for " + req.name);
            data.put("att_id", att.getAttId());
            data.put("duplicate", false);
            return ok(data, HttpStatus.CREATED);

        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to log attendance", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // DELETE /api/attendance/:att_id — Remove specific log
    @DeleteMapping("/{att_id}")
    public ResponseEntity<Map<String, Object>> deleteRecord(@PathVariable("att_id") Integer attId) {
        try {
            if (!attendanceRepository.existsById(attId)) {
                return err("Record not found", HttpStatus.NOT_FOUND);
            }
            attendanceRepository.deleteById(attId);
            
            Map<String, Object> data = new HashMap<>();
            data.put("message", "Record deleted");
            return ok(data);
        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to delete attendance record", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Request DTO definition
    public static class AttendanceRequest {
        public String emp_id;
        public String name;
        public String dept;
        public String role;
        public String timestamp;
        public String status;
    }
}
