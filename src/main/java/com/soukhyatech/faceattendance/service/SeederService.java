package com.soukhyatech.faceattendance.service;

import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.model.User;
import com.soukhyatech.faceattendance.repository.EmployeeRepository;
import com.soukhyatech.faceattendance.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SeederService {

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PiiEncryptionService piiEncryptionService;

    @Value("${app.seeder.admin-username:admin}")
    private String adminUsername;

    @Value("${app.seeder.admin-password:admin123}")
    private String adminPassword;

    @EventListener(ContextRefreshedEvent.class)
    @Transactional
    public void seed() {
        ensureAdminUser();
        if (employeeRepository.count() > 0) {
            System.out.println("[SEEDER] Database already seeded. Skipping.");
            return;
        }
        System.out.println("[SEEDER] Seeding 100 realistic employees...");
        List<Employee> employees = generateEmployees();
        employeeRepository.saveAll(employees);
        System.out.println("[SEEDER] Seeded " + employees.size() + " employees.");
    }

    private void ensureAdminUser() {
        if (userRepository.findByUsernameAndActiveTrue(adminUsername).isEmpty()) {
            User admin = User.builder()
                .username(adminUsername)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .role(User.Role.ADMIN)
                .active(true)
                .build();
            userRepository.save(admin);
            System.out.println("[AUTH] Default admin created: " + adminUsername);
        }
    }

    private List<Employee> generateEmployees() {
        String[] firstNames = {"John","Jane","Robert","Mary","William","David","James","Patricia","Michael","Linda"};
        String[] lastNames = {"Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez"};
        String[] depts = {"Engineering","HR","Finance","Marketing","Operations","Sales","IT"};
        String[][] roles = {
            {"Software Engineer","Senior Engineer","Engineering Manager","Frontend Developer","Backend Developer"},
            {"HR Generalist","Recruiter","HR Manager","Talent Acquisition Specialist"},
            {"Financial Analyst","Accountant","Finance Manager","Billing Specialist"},
            {"Marketing Specialist","Content Strategist","Marketing Manager","SEO Analyst"},
            {"Operations Analyst","Operations Manager","Logistics Coordinator","Project Manager"},
            {"Account Executive","Sales Manager","Sales Specialist","Business Representative"},
            {"System Administrator","IT Support Specialist","Network Engineer","Security Analyst"}
        };
        Employee.Status[] statuses = new Employee.Status[100];
        for (int i = 0; i < 75; i++) statuses[i] = Employee.Status.Active;
        for (int i = 75; i < 85; i++) statuses[i] = Employee.Status.Hibernate;
        for (int i = 85; i < 95; i++) statuses[i] = Employee.Status.On_Leave;
        for (int i = 95; i < 100; i++) statuses[i] = Employee.Status.Resigned;

        List<Employee> list = new ArrayList<>();
        Set<String> usedNames = java.util.HashSet.newHashSet(100);

        for (int i = 1; i <= 100; i++) {
            String id = String.format("EMP%03d", i);
            String fullName;
            do {
                fullName = firstNames[(int)(Math.random()*firstNames.length)] + " " +
                           lastNames[(int)(Math.random()*lastNames.length)];
            } while (!usedNames.add(fullName));

            int d = (int)(Math.random() * depts.length);
            String dept = depts[d];
            String role = roles[d][(int)(Math.random() * roles[d].length)];
            Employee.Status status = statuses[i-1];

            double[] desc = new double[128];
            for (int j = 0; j < 128; j++) desc[j] = (Math.random() - 0.5) * 0.15;
            String descJson = java.util.Arrays.toString(desc).replace(" ", "");
            String descHash = sha256Base64(descJson);

            Employee emp = Employee.builder()
                .id(id)
                .name(fullName)
                .department(dept)
                .role(role)
                .descriptor(descJson)
                .descriptorHash(descHash)
                .status(status)
                .build();

            if (status == Employee.Status.Hibernate) {
                emp.setHibernateStartDate("2026-01-" + String.format("%02d", (int)(Math.random()*28)+1));
                emp.setHibernateEndDate("2026-06-" + String.format("%02d", (int)(Math.random()*28)+1));
                emp.setHibernateReason("Temporary leave");
            }
            list.add(emp);
        }
        return list;
    }

    private String sha256Base64(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(input.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
