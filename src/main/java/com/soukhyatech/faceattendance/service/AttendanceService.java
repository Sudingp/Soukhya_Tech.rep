package com.soukhyatech.faceattendance.service;

import com.soukhyatech.faceattendance.model.Attendance;
import com.soukhyatech.faceattendance.model.AuditLog;
import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.repository.AttendanceRepository;
import com.soukhyatech.faceattendance.repository.EmployeeRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<Attendance> getAll(int page, int size) {
        return attendanceRepository.findAll(PageRequest.of(page - 1, size)).getContent();
    }

    @Transactional(readOnly = true)
    public List<Attendance> getByDate(String dateStr, int page, int size) {
        String start = dateStr + "T00:00:00";
        String end = dateStr + "T23:59:59.999";
        return attendanceRepository.findByDateRange(start, end);
    }

    @Transactional(readOnly = true)
    public List<Attendance> getByEmpId(String empId, int page, int size) {
        return attendanceRepository.findByEmpId(empId);
    }

    @CacheEvict(value = "attendance", allEntries = true)
    @Transactional
    public Attendance logAttendance(Attendance att, String loggedBy, HttpServletRequest req) {
        Employee emp = employeeRepository.findById(att.getEmpId())
            .orElseThrow(() -> new IllegalArgumentException("Employee not registered"));

        if (emp.getStatus() == Employee.Status.Hibernate) {
            throw new IllegalStateException("Employee currently in Hibernate Mode. Attendance disabled.");
        }

        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        String start = today + "T00:00:00";
        String end = today + "T23:59:59.999";
        Optional<Attendance> dup = attendanceRepository.findTodayByEmpId(att.getEmpId(), start, end);
        if (dup.isPresent()) {
            throw new IllegalStateException("Attendance already logged today");
        }

        att.setName(emp.getName());
        att.setDept(emp.getDepartment());
        att.setRole(emp.getRole());
        att.setLoggedBy(loggedBy);
        if (req != null) {
            att.setIpAddress(req.getRemoteAddr());
            att.setUserAgent(req.getHeader("User-Agent"));
        }

        Attendance saved = attendanceRepository.save(att);
        auditLogService.log("attendance", String.valueOf(saved.getAttId()), AuditLog.Action.INSERT,
            null, Map.of("emp_id", att.getEmpId(), "status", att.getStatus()), loggedBy, req);
        return saved;
    }

    @CacheEvict(value = "attendance", allEntries = true)
    @Transactional
    public void delete(Integer attId, String deletedBy, HttpServletRequest req) {
        attendanceRepository.deleteById(attId);
        auditLogService.log("attendance", String.valueOf(attId), AuditLog.Action.DELETE,
            null, null, deletedBy, req);
    }

    @Cacheable(value = "stats", key = "'today'")
    @Transactional(readOnly = true)
    public AttendanceRepository.TodayStats getTodayStats() {
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        String start = today + "T00:00:00";
        String end = today + "T23:59:59.999";
        return attendanceRepository.getTodayStats(start, end);
    }

    @Transactional(readOnly = true)
    public long count() {
        return attendanceRepository.count();
    }
}
