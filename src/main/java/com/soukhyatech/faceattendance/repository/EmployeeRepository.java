package com.soukhyatech.faceattendance.repository;

import com.soukhyatech.faceattendance.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, String> {

    @Query("SELECT COUNT(e) FROM Employee e WHERE e.status = :status")
    long countByStatus(@Param("status") String status);

    // Native query to count Hibernated employees by department
    @Query(value = "SELECT department, COUNT(*) as count FROM employees WHERE status = 'Hibernate' GROUP BY department", nativeQuery = true)
    List<Map<String, Object>> getDeptHibernateCounts();

    // Native query to get monthly trend of Hibernate start dates
    @Query(value = "SELECT substr(hibernate_start_date, 1, 7) as month, COUNT(*) as count FROM employees WHERE status = 'Hibernate' AND hibernate_start_date IS NOT NULL AND hibernate_start_date != '' GROUP BY month ORDER BY month ASC", nativeQuery = true)
    List<Map<String, Object>> getMonthlyHibernateTrends();
}
