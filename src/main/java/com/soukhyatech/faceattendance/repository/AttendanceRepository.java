package com.soukhyatech.faceattendance.repository;

import com.soukhyatech.faceattendance.model.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Integer> {

    List<Attendance> findAllByOrderByTimestampDesc();

    List<Attendance> findByEmpIdOrderByTimestampDesc(String empId);

    // Native query to filter attendance by calendar date (matching YYYY-MM-DD)
    @Query(value = "SELECT * FROM attendance WHERE date(timestamp) = date(:dateStr) ORDER BY timestamp DESC", nativeQuery = true)
    List<Attendance> getAttByDate(@Param("dateStr") String dateStr);

    // Native query to check if employee has logged attendance today (local time)
    @Query(value = "SELECT * FROM attendance WHERE emp_id = :empId AND date(timestamp) = date('now','localtime') LIMIT 1", nativeQuery = true)
    List<Attendance> checkDuplicateToday(@Param("empId") String empId);

    // Native query to get today's stats (distinct present count and late count)
    @Query(value = "SELECT COUNT(DISTINCT emp_id) as present_today, COALESCE(SUM(CASE WHEN status='Late' THEN 1 ELSE 0 END), 0) as late_today FROM attendance WHERE date(timestamp) = date('now','localtime')", nativeQuery = true)
    Map<String, Object> getStatsToday();
}
