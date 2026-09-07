package com.soukhyatech.faceattendance.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "employees", indexes = {
    @Index(name = "idx_emp_status_dept", columnList = "status, department"),
    @Index(name = "idx_emp_company", columnList = "company")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

    @Id
    @Column(length = 20)
    @Pattern(regexp = "^EMP\\d{3,}$", message = "ID must match EMP### format")
    private String id;

    @Column(nullable = false, length = 100)
    @NotBlank
    @Size(min = 2, max = 100)
    private String name;

    @Column(nullable = false, length = 50)
    @NotBlank
    private String department;

    @Column(nullable = false, length = 100)
    @NotBlank
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descriptor;

    @Column(nullable = false, length = 64)
    private String descriptorHash;

    @Column(columnDefinition = "TEXT")
    private String image;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Status status = Status.Active;

    public enum Status {
        Active, Hibernate, On_Leave, Resigned
    }

    // Hibernate fields
    @Column(name = "hibernate_start_date")
    private String hibernateStartDate;

    @Column(name = "hibernate_end_date")
    private String hibernateEndDate;

    @Column(name = "hibernate_reason", length = 500)
    private String hibernateReason;

    // Enterprise HR fields
    @Column(length = 100)
    private String company;

    @Column(length = 100)
    private String designation;

    @Column(length = 10)
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

    @Column(length = 100)
    @Email
    private String email;

    @Column(name = "reporting_to", length = 50)
    private String reportingTo;

    @Column(name = "device_code", length = 50)
    private String deviceCode;

    @Column(name = "sub_department", length = 100)
    private String subDepartment;

    @Column(length = 100)
    private String division;

    @Column(length = 50)
    private String grade;

    @Column(length = 100)
    private String team;

    @Column(length = 100)
    private String location;

    @Column(name = "employment_type", length = 20)
    private String employmentType;

    @Column(length = 50)
    private String category;

    @Column(name = "holiday_group", length = 100)
    private String holidayGroup;

    @Column(name = "shift_group", length = 100)
    private String shiftGroup;

    @Column(name = "shift_roster", length = 100)
    private String shiftRoster;

    @Column(length = 100)
    private String geofence;

    @Column(name = "device_expiry_rule_applicable")
    private Integer deviceExpiryRuleApplicable;

    @Column(name = "verification_type", length = 100)
    private String verificationType;

    @Column(name = "expiry_start_date")
    private String expiryStartDate;

    @Column(name = "expiry_end_date")
    private String expiryEndDate;
}
