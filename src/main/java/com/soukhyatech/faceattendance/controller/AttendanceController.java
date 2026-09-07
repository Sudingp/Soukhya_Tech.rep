package com.soukhyatech.faceattendance.controller;

import com.soukhyatech.faceattendance.model.Attendance;
import com.soukhyatech.faceattendance.service.AttendanceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<Map<String, Object>> getAll(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String emp_id) {

        var records = date != null ? attendanceService.getByDate(date, page, size)
            : emp_id != null ? attendanceService.getByEmpId(emp_id, page, size)
            : attendanceService.getAll(page, size);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("records", records);
        res.put("pagination", Map.of("page", page, "size", size));
        return ResponseEntity.ok(res);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','HR','DEVICE')")
    public ResponseEntity<Map<String, Object>> create(
            @Valid @RequestBody Attendance att, Authentication auth, HttpServletRequest req) {
        Attendance saved = attendanceService.logAttendance(att, auth.getName(), req);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", saved.getStatus() + " logged for " + saved.getName());
        res.put("att_id", saved.getAttId());
        res.put("duplicate", false);
        return ResponseEntity.status(201).body(res);
    }

    @DeleteMapping("/{att_id}")
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<Map<String, Object>> delete(
            @PathVariable Integer att_id, Authentication auth, HttpServletRequest req) {
        attendanceService.delete(att_id, auth.getName(), req);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", "Record deleted");
        return ResponseEntity.ok(res);
    }
}
