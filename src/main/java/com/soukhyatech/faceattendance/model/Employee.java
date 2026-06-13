package com.soukhyatech.faceattendance.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonRawValue;
import java.time.Instant;

@Entity
@Table(name = "employees")
public class Employee {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String department;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    @JsonRawValue
    private String descriptor; // JSON array of 128 floats stored as raw string in SQLite

    @Column(columnDefinition = "TEXT")
    private String image; // base64 JPEG data URL

    @Column(name = "created_at", nullable = false)
    private String createdAt;

    @Column(columnDefinition = "TEXT DEFAULT 'Active'")
    private String status = "Active";

    @Column(name = "hibernate_start_date")
    private String hibernateStartDate;

    @Column(name = "hibernate_end_date")
    private String hibernateEndDate;

    @Column(name = "hibernate_reason")
    private String hibernateReason;

    // ── Optional Enterprise Info (Pre-existing) ──
    @Column(name = "company")
    private String company;

    @Column(name = "designation")
    private String designation;

    @Column(name = "gender")
    private String gender;

    @Column(name = "date_of_joining")
    private String dateOfJoining;

    @Column(name = "date_of_confirmation")
    private String dateOfConfirmation;

    @Column(name = "last_working_day")
    private String lastWorkingDay;

    @Column(name = "aadhaar_number")
    private String aadhaarNumber;

    @Column(name = "pan_number")
    private String panNumber;

    @Column(name = "card_number")
    private String cardNumber;

    @Column(name = "phone_no")
    private String phoneNo;

    @Column(name = "email")
    private String email;

    @Column(name = "reporting_to")
    private String reportingTo;

    // ── eTimeTrackLite Replica Fields (New) ──
    @Column(name = "device_code")
    private String deviceCode;

    @Column(name = "sub_department")
    private String subDepartment;

    @Column(name = "division")
    private String division;

    @Column(name = "grade")
    private String grade;

    @Column(name = "team")
    private String team;

    @Column(name = "location")
    private String location;

    @Column(name = "employment_type")
    private String employmentType;

    @Column(name = "category")
    private String category;

    @Column(name = "holiday_group")
    private String holidayGroup;

    @Column(name = "shift_group")
    private String shiftGroup;

    @Column(name = "shift_roster")
    private String shiftRoster;

    @Column(name = "geofence")
    private String geofence;

    @Column(name = "device_expiry_rule_applicable")
    private Boolean deviceExpiryRuleApplicable;

    @Column(name = "verification_type")
    private String verificationType;

    @Column(name = "expiry_start_date")
    private String expiryStartDate;

    @Column(name = "expiry_end_date")
    private String expiryEndDate;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now().toString();
        }
        if (status == null) {
            status = "Active";
        }
    }

    // Default Constructor
    public Employee() {}

    // Constructor with all fields
    public Employee(String id, String name, String department, String role, String descriptor, String image, String createdAt, String status, String hibernateStartDate, String hibernateEndDate, String hibernateReason, String company, String designation, String gender, String dateOfJoining, String dateOfConfirmation, String lastWorkingDay, String aadhaarNumber, String panNumber, String cardNumber, String phoneNo, String email, String reportingTo, String deviceCode, String subDepartment, String division, String grade, String team, String location, String employmentType, String category, String holidayGroup, String shiftGroup, String shiftRoster, String geofence, Boolean deviceExpiryRuleApplicable, String verificationType, String expiryStartDate, String expiryEndDate) {
        this.id = id;
        this.name = name;
        this.department = department;
        this.role = role;
        this.descriptor = descriptor;
        this.image = image;
        this.createdAt = createdAt;
        this.status = status;
        this.hibernateStartDate = hibernateStartDate;
        this.hibernateEndDate = hibernateEndDate;
        this.hibernateReason = hibernateReason;
        this.company = company;
        this.designation = designation;
        this.gender = gender;
        this.dateOfJoining = dateOfJoining;
        this.dateOfConfirmation = dateOfConfirmation;
        this.lastWorkingDay = lastWorkingDay;
        this.aadhaarNumber = aadhaarNumber;
        this.panNumber = panNumber;
        this.cardNumber = cardNumber;
        this.phoneNo = phoneNo;
        this.email = email;
        this.reportingTo = reportingTo;
        this.deviceCode = deviceCode;
        this.subDepartment = subDepartment;
        this.division = division;
        this.grade = grade;
        this.team = team;
        this.location = location;
        this.employmentType = employmentType;
        this.category = category;
        this.holidayGroup = holidayGroup;
        this.shiftGroup = shiftGroup;
        this.shiftRoster = shiftRoster;
        this.geofence = geofence;
        this.deviceExpiryRuleApplicable = deviceExpiryRuleApplicable;
        this.verificationType = verificationType;
        this.expiryStartDate = expiryStartDate;
        this.expiryEndDate = expiryEndDate;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getDescriptor() { return descriptor; }
    public void setDescriptor(String descriptor) { this.descriptor = descriptor; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getHibernateStartDate() { return hibernateStartDate; }
    public void setHibernateStartDate(String hibernateStartDate) { this.hibernateStartDate = hibernateStartDate; }

    public String getHibernateEndDate() { return hibernateEndDate; }
    public void setHibernateEndDate(String hibernateEndDate) { this.hibernateEndDate = hibernateEndDate; }

    public String getHibernateReason() { return hibernateReason; }
    public void setHibernateReason(String hibernateReason) { this.hibernateReason = hibernateReason; }

    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getDateOfJoining() { return dateOfJoining; }
    public void setDateOfJoining(String dateOfJoining) { this.dateOfJoining = dateOfJoining; }

    public String getDateOfConfirmation() { return dateOfConfirmation; }
    public void setDateOfConfirmation(String dateOfConfirmation) { this.dateOfConfirmation = dateOfConfirmation; }

    public String getLastWorkingDay() { return lastWorkingDay; }
    public void setLastWorkingDay(String lastWorkingDay) { this.lastWorkingDay = lastWorkingDay; }

    public String getAadhaarNumber() { return aadhaarNumber; }
    public void setAadhaarNumber(String aadhaarNumber) { this.aadhaarNumber = aadhaarNumber; }

    public String getPanNumber() { return panNumber; }
    public void setPanNumber(String panNumber) { this.panNumber = panNumber; }

    public String getCardNumber() { return cardNumber; }
    public void setCardNumber(String cardNumber) { this.cardNumber = cardNumber; }

    public String getPhoneNo() { return phoneNo; }
    public void setPhoneNo(String phoneNo) { this.phoneNo = phoneNo; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getReportingTo() { return reportingTo; }
    public void setReportingTo(String reportingTo) { this.reportingTo = reportingTo; }

    // Getters/Setters for new fields
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }

    public String getSubDepartment() { return subDepartment; }
    public void setSubDepartment(String subDepartment) { this.subDepartment = subDepartment; }

    public String getDivision() { return division; }
    public void setDivision(String division) { this.division = division; }

    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }

    public String getTeam() { return team; }
    public void setTeam(String team) { this.team = team; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getEmploymentType() { return employmentType; }
    public void setEmploymentType(String employmentType) { this.employmentType = employmentType; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getHolidayGroup() { return holidayGroup; }
    public void setHolidayGroup(String holidayGroup) { this.holidayGroup = holidayGroup; }

    public String getShiftGroup() { return shiftGroup; }
    public void setShiftGroup(String shiftGroup) { this.shiftGroup = shiftGroup; }

    public String getShiftRoster() { return shiftRoster; }
    public void setShiftRoster(String shiftRoster) { this.shiftRoster = shiftRoster; }

    public String getGeofence() { return geofence; }
    public void setGeofence(String geofence) { this.geofence = geofence; }

    public Boolean getDeviceExpiryRuleApplicable() { return deviceExpiryRuleApplicable; }
    public void setDeviceExpiryRuleApplicable(Boolean deviceExpiryRuleApplicable) { this.deviceExpiryRuleApplicable = deviceExpiryRuleApplicable; }

    public String getVerificationType() { return verificationType; }
    public void setVerificationType(String verificationType) { this.verificationType = verificationType; }

    public String getExpiryStartDate() { return expiryStartDate; }
    public void setExpiryStartDate(String expiryStartDate) { this.expiryStartDate = expiryStartDate; }

    public String getExpiryEndDate() { return expiryEndDate; }
    public void setExpiryEndDate(String expiryEndDate) { this.expiryEndDate = expiryEndDate; }

    // Builder pattern implementation
    public static EmployeeBuilder builder() {
        return new EmployeeBuilder();
    }

    public static class EmployeeBuilder {
        private String id;
        private String name;
        private String department;
        private String role;
        private String descriptor;
        private String image;
        private String createdAt;
        private String status;
        private String hibernateStartDate;
        private String hibernateEndDate;
        private String hibernateReason;
        private String company;
        private String designation;
        private String gender;
        private String dateOfJoining;
        private String dateOfConfirmation;
        private String lastWorkingDay;
        private String aadhaarNumber;
        private String panNumber;
        private String cardNumber;
        private String phoneNo;
        private String email;
        private String reportingTo;
        private String deviceCode;
        private String subDepartment;
        private String division;
        private String grade;
        private String team;
        private String location;
        private String employmentType;
        private String category;
        private String holidayGroup;
        private String shiftGroup;
        private String shiftRoster;
        private String geofence;
        private Boolean deviceExpiryRuleApplicable;
        private String verificationType;
        private String expiryStartDate;
        private String expiryEndDate;

        EmployeeBuilder() {}

        public EmployeeBuilder id(String id) { this.id = id; return this; }
        public EmployeeBuilder name(String name) { this.name = name; return this; }
        public EmployeeBuilder department(String department) { this.department = department; return this; }
        public EmployeeBuilder role(String role) { this.role = role; return this; }
        public EmployeeBuilder descriptor(String descriptor) { this.descriptor = descriptor; return this; }
        public EmployeeBuilder image(String image) { this.image = image; return this; }
        public EmployeeBuilder createdAt(String createdAt) { this.createdAt = createdAt; return this; }
        public EmployeeBuilder status(String status) { this.status = status; return this; }
        public EmployeeBuilder hibernateStartDate(String hibernateStartDate) { this.hibernateStartDate = hibernateStartDate; return this; }
        public EmployeeBuilder hibernateEndDate(String hibernateEndDate) { this.hibernateEndDate = hibernateEndDate; return this; }
        public EmployeeBuilder hibernateReason(String hibernateReason) { this.hibernateReason = hibernateReason; return this; }
        public EmployeeBuilder company(String company) { this.company = company; return this; }
        public EmployeeBuilder designation(String designation) { this.designation = designation; return this; }
        public EmployeeBuilder gender(String gender) { this.gender = gender; return this; }
        public EmployeeBuilder dateOfJoining(String dateOfJoining) { this.dateOfJoining = dateOfJoining; return this; }
        public EmployeeBuilder dateOfConfirmation(String dateOfConfirmation) { this.dateOfConfirmation = dateOfConfirmation; return this; }
        public EmployeeBuilder lastWorkingDay(String lastWorkingDay) { this.lastWorkingDay = lastWorkingDay; return this; }
        public EmployeeBuilder aadhaarNumber(String aadhaarNumber) { this.aadhaarNumber = aadhaarNumber; return this; }
        public EmployeeBuilder panNumber(String panNumber) { this.panNumber = panNumber; return this; }
        public EmployeeBuilder cardNumber(String cardNumber) { this.cardNumber = cardNumber; return this; }
        public EmployeeBuilder phoneNo(String phoneNo) { this.phoneNo = phoneNo; return this; }
        public EmployeeBuilder email(String email) { this.email = email; return this; }
        public EmployeeBuilder reportingTo(String reportingTo) { this.reportingTo = reportingTo; return this; }
        public EmployeeBuilder deviceCode(String deviceCode) { this.deviceCode = deviceCode; return this; }
        public EmployeeBuilder subDepartment(String subDepartment) { this.subDepartment = subDepartment; return this; }
        public EmployeeBuilder division(String division) { this.division = division; return this; }
        public EmployeeBuilder grade(String grade) { this.grade = grade; return this; }
        public EmployeeBuilder team(String team) { this.team = team; return this; }
        public EmployeeBuilder location(String location) { this.location = location; return this; }
        public EmployeeBuilder employmentType(String employmentType) { this.employmentType = employmentType; return this; }
        public EmployeeBuilder category(String category) { this.category = category; return this; }
        public EmployeeBuilder holidayGroup(String holidayGroup) { this.holidayGroup = holidayGroup; return this; }
        public EmployeeBuilder shiftGroup(String shiftGroup) { this.shiftGroup = shiftGroup; return this; }
        public EmployeeBuilder shiftRoster(String shiftRoster) { this.shiftRoster = shiftRoster; return this; }
        public EmployeeBuilder geofence(String geofence) { this.geofence = geofence; return this; }
        public EmployeeBuilder deviceExpiryRuleApplicable(Boolean deviceExpiryRuleApplicable) { this.deviceExpiryRuleApplicable = deviceExpiryRuleApplicable; return this; }
        public EmployeeBuilder verificationType(String verificationType) { this.verificationType = verificationType; return this; }
        public EmployeeBuilder expiryStartDate(String expiryStartDate) { this.expiryStartDate = expiryStartDate; return this; }
        public EmployeeBuilder expiryEndDate(String expiryEndDate) { this.expiryEndDate = expiryEndDate; return this; }

        public Employee build() {
            return new Employee(id, name, department, role, descriptor, image, createdAt, status, hibernateStartDate, hibernateEndDate, hibernateReason, company, designation, gender, dateOfJoining, dateOfConfirmation, lastWorkingDay, aadhaarNumber, panNumber, cardNumber, phoneNo, email, reportingTo, deviceCode, subDepartment, division, grade, team, location, employmentType, category, holidayGroup, shiftGroup, shiftRoster, geofence, deviceExpiryRuleApplicable, verificationType, expiryStartDate, expiryEndDate);
        }
    }
}
