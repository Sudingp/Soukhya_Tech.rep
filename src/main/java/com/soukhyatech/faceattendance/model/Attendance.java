package com.soukhyatech.faceattendance.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "attendance", indexes = {
    @Index(name = "idx_att_emp_ts", columnList = "empId, timestamp"),
    @Index(name = "idx_att_ts", columnList = "timestamp")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "att_id")
    private Integer attId;

    @Column(name = "emp_id", nullable = false, length = 20)
    @NotBlank
    private String empId;

    @Column(nullable = false, length = 100)
    @NotBlank
    private String name;

    @Column(nullable = false, length = 50)
    @NotBlank
    private String dept;

    @Column(nullable = false, length = 100)
    @NotBlank
    private String role;

    @Column(nullable = false)
    @NotBlank
    private String timestamp;

    @Column(nullable = false, length = 10)
    @NotNull
    @Builder.Default
    private String status = "Present";

    @Column(name = "logged_by", length = 50)
    private String loggedBy;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;
}
