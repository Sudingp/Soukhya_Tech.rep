package com.soukhyatech.faceattendance.repository;

import com.soukhyatech.faceattendance.model.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Integer> {

    List<Attendance> findAllByOrderByTimestampDesc();

    @Query("SELECT a FROM Attendance a WHERE a.empId = :empId ORDER BY a.timestamp DESC")
    List<Attendance> findByEmpId(@Param("empId") String empId);

    @Query("SELECT a FROM Attendance a WHERE a.timestamp >= :start AND a.timestamp < :end ORDER BY a.timestamp DESC")
    List<Attendance> findByDateRange(@Param("start") String start, @Param("end") String end);

    @Query("SELECT a FROM Attendance a WHERE a.timestamp >= :start AND a.timestamp < :end AND a.empId = :empId ORDER BY a.timestamp DESC LIMIT 1")
    Optional<Attendance> findTodayByEmpId(@Param("empId") String empId, @Param("start") String start, @Param("end") String end);

    @Query("SELECT COUNT(DISTINCT a.empId) as presentToday, COALESCE(SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END), 0) as lateToday FROM Attendance a WHERE a.timestamp >= :start AND a.timestamp < :end")
    TodayStats getTodayStats(@Param("start") String start, @Param("end") String end);

    interface TodayStats {
        Long getPresentToday();
        Long getLateToday();
    }
}
