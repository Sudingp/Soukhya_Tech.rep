package com.soukhyatech.faceattendance.repository;

import com.soukhyatech.faceattendance.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, String> {

    Optional<Employee> findByIdAndStatusNot(String id, Employee.Status status);

    List<Employee> findAllByOrderByCreatedAtDesc();

    List<Employee> findByStatusOrderByCreatedAtDesc(Employee.Status status);

    long countByStatus(Employee.Status status);

    @Query("SELECT e.department as department, COUNT(e) as count FROM Employee e WHERE e.status = 'Hibernate' GROUP BY e.department")
    List<DeptHibernateCount> getDeptHibernateCounts();

    @Query("SELECT SUBSTRING(e.hibernateStartDate, 1, 7) as month, COUNT(e) as count FROM Employee e WHERE e.status = 'Hibernate' AND e.hibernateStartDate IS NOT NULL GROUP BY month ORDER BY month")
    List<MonthlyHibernateTrend> getMonthlyHibernateTrends();

    interface DeptHibernateCount {
        String getDepartment();
        Long getCount();
    }

    interface MonthlyHibernateTrend {
        String getMonth();
        Long getCount();
    }
}
