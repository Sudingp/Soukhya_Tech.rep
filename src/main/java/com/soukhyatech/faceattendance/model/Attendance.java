package com.soukhyatech.faceattendance.model;

import jakarta.persistence.*;

@Entity
@Table(name = "attendance")
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "att_id")
    private Integer attId;

    @Column(name = "emp_id", nullable = false)
    private String empId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String dept;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String timestamp; // ISO 8601 string

    @Column(nullable = false)
    private String status; // 'Present' or 'Late'

    // Constructors
    public Attendance() {}

    public Attendance(Integer attId, String empId, String name, String dept, String role, String timestamp, String status) {
        this.attId = attId;
        this.empId = empId;
        this.name = name;
        this.dept = dept;
        this.role = role;
        this.timestamp = timestamp;
        this.status = status;
    }

    // Getters and Setters
    public Integer getAttId() { return attId; }
    public void setAttId(Integer attId) { this.attId = attId; }

    public String getEmpId() { return empId; }
    public void setEmpId(String empId) { this.empId = empId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDept() { return dept; }
    public void setDept(String dept) { this.dept = dept; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    // Builder pattern implementation
    public static AttendanceBuilder builder() {
        return new AttendanceBuilder();
    }

    public static class AttendanceBuilder {
        private Integer attId;
        private String empId;
        private String name;
        private String dept;
        private String role;
        private String timestamp;
        private String status;

        AttendanceBuilder() {}

        public AttendanceBuilder attId(Integer attId) { this.attId = attId; return this; }
        public AttendanceBuilder empId(String empId) { this.empId = empId; return this; }
        public AttendanceBuilder name(String name) { this.name = name; return this; }
        public AttendanceBuilder dept(String dept) { this.dept = dept; return this; }
        public AttendanceBuilder role(String role) { this.role = role; return this; }
        public AttendanceBuilder timestamp(String timestamp) { this.timestamp = timestamp; return this; }
        public AttendanceBuilder status(String status) { this.status = status; return this; }

        public Attendance build() {
            return new Attendance(attId, empId, name, dept, role, timestamp, status);
        }
    }
}
