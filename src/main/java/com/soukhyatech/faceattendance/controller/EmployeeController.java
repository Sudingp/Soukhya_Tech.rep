package com.soukhyatech.faceattendance.controller;

import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.repository.EmployeeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/employees")
@CrossOrigin // Enable CORS for development
public class EmployeeController {

    @Autowired
    private EmployeeRepository employeeRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    // Utility response helpers
    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> data) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.putAll(data);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> data, HttpStatus status) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.putAll(data);
        return ResponseEntity.status(status).body(response);
    }

    private ResponseEntity<Map<String, Object>> err(String msg, HttpStatus status) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("error", msg);
        return ResponseEntity.status(status).body(response);
    }

    // GET /api/employees — List all employees
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllEmployees() {
        try {
            List<Employee> employees = employeeRepository.findAll();
            // Sort by createdAt descending
            employees.sort((e1, e2) -> {
                if (e1.getCreatedAt() == null) return 1;
                if (e2.getCreatedAt() == null) return -1;
                return e2.getCreatedAt().compareTo(e1.getCreatedAt());
            });
            
            Map<String, Object> data = new HashMap<>();
            data.put("employees", employees);
            return ok(data);
        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to fetch employees", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // GET /api/employees/:id — Get single employee
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getEmployee(@PathVariable("id") String id) {
        try {
            Optional<Employee> empOpt = employeeRepository.findById(id);
            if (empOpt.isEmpty()) {
                return err("Employee not found", HttpStatus.NOT_FOUND);
            }
            
            Map<String, Object> data = new HashMap<>();
            data.put("employee", empOpt.get());
            return ok(data);
        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to fetch employee", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // POST /api/employees — Register new employee
    @PostMapping
    public ResponseEntity<Map<String, Object>> registerEmployee(@RequestBody EmployeeRequest req) {
        try {
            if (req.id == null || req.name == null || req.department == null || req.role == null || req.descriptor == null) {
                return err("Missing required fields: id, name, department, role, descriptor", HttpStatus.BAD_REQUEST);
            }

            if (req.descriptor.size() != 128) {
                return err("descriptor must be an array of 128 floats", HttpStatus.BAD_REQUEST);
            }

            if (employeeRepository.existsById(req.id)) {
                return err("Employee ID \"" + req.id + "\" already exists", HttpStatus.CONFLICT);
            }

            // Convert descriptor list to JSON string
            String descriptorJson = mapper.writeValueAsString(req.descriptor);
            String finalStatus = req.status != null ? req.status : "Active";

            Employee emp = Employee.builder()
                    .id(req.id)
                    .name(req.name)
                    .department(req.department)
                    .role(req.role)
                    .descriptor(descriptorJson)
                    .image(req.image)
                    .status(finalStatus)
                    .hibernateStartDate("Hibernate".equals(finalStatus) ? req.hibernate_start_date : null)
                    .hibernateEndDate("Hibernate".equals(finalStatus) ? req.hibernate_end_date : null)
                    .hibernateReason("Hibernate".equals(finalStatus) ? req.hibernate_reason : null)
                    .company(req.company)
                    .designation(req.designation)
                    .gender(req.gender)
                    .dateOfJoining(req.date_of_joining)
                    .dateOfConfirmation(req.date_of_confirmation)
                    .lastWorkingDay(req.last_working_day)
                    .aadhaarNumber(req.aadhaar_number)
                    .panNumber(req.pan_number)
                    .cardNumber(req.card_number)
                    .phoneNo(req.phone_no)
                    .email(req.email)
                    .reportingTo(req.reporting_to)
                    
                    // replica fields
                    .deviceCode(req.device_code)
                    .subDepartment(req.sub_department)
                    .division(req.division)
                    .grade(req.grade)
                    .team(req.team)
                    .location(req.location)
                    .employmentType(req.employment_type)
                    .category(req.category)
                    .holidayGroup(req.holiday_group)
                    .shiftGroup(req.shift_group)
                    .shiftRoster(req.shift_roster)
                    .geofence(req.geofence)
                    .deviceExpiryRuleApplicable(req.device_expiry_rule_applicable)
                    .verificationType(req.verification_type)
                    .expiryStartDate(req.expiry_start_date)
                    .expiryEndDate(req.expiry_end_date)
                    .build();

            employeeRepository.save(emp);

            Map<String, Object> data = new HashMap<>();
            data.put("message", "Employee \"" + req.name + "\" registered successfully");
            data.put("id", req.id);
            return ok(data, HttpStatus.CREATED);

        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to register employee", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // PUT /api/employees/:id — Update employee
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateEmployee(@PathVariable("id") String id, @RequestBody EmployeeRequest req) {
        try {
            Optional<Employee> empOpt = employeeRepository.findById(id);
            if (empOpt.isEmpty()) {
                return err("Employee not found", HttpStatus.NOT_FOUND);
            }

            Employee existing = empOpt.get();
            if (req.name != null) existing.setName(req.name);
            if (req.department != null) existing.setDepartment(req.department);
            if (req.role != null) existing.setRole(req.role);
            if (req.image != null) existing.setImage(req.image);
            if (req.status != null) existing.setStatus(req.status);
            
            if (req.descriptor != null && req.descriptor.size() == 128) {
                existing.setDescriptor(mapper.writeValueAsString(req.descriptor));
            }

            String finalStatus = existing.getStatus();
            if ("Hibernate".equals(finalStatus)) {
                if (req.hibernate_start_date != null) existing.setHibernateStartDate(req.hibernate_start_date);
                if (req.hibernate_end_date != null) existing.setHibernateEndDate(req.hibernate_end_date);
                if (req.hibernate_reason != null) existing.setHibernateReason(req.hibernate_reason);
            } else {
                existing.setHibernateStartDate(null);
                existing.setHibernateEndDate(null);
                existing.setHibernateReason(null);
            }

            // Optional Enterprise Info Updates
            if (req.company != null) existing.setCompany(req.company);
            if (req.designation != null) existing.setDesignation(req.designation);
            if (req.gender != null) existing.setGender(req.gender);
            if (req.date_of_joining != null) existing.setDateOfJoining(req.date_of_joining);
            if (req.date_of_confirmation != null) existing.setDateOfConfirmation(req.date_of_confirmation);
            if (req.last_working_day != null) existing.setLastWorkingDay(req.last_working_day);
            if (req.aadhaar_number != null) existing.setAadhaarNumber(req.aadhaar_number);
            if (req.pan_number != null) existing.setPanNumber(req.pan_number);
            if (req.card_number != null) existing.setCardNumber(req.card_number);
            if (req.phone_no != null) existing.setPhoneNo(req.phone_no);
            if (req.email != null) existing.setEmail(req.email);
            if (req.reporting_to != null) existing.setReportingTo(req.reporting_to);

            // eTimeTrackLite Replica Fields Updates
            if (req.device_code != null) existing.setDeviceCode(req.device_code);
            if (req.sub_department != null) existing.setSubDepartment(req.sub_department);
            if (req.division != null) existing.setDivision(req.division);
            if (req.grade != null) existing.setGrade(req.grade);
            if (req.team != null) existing.setTeam(req.team);
            if (req.location != null) existing.setLocation(req.location);
            if (req.employment_type != null) existing.setEmploymentType(req.employment_type);
            if (req.category != null) existing.setCategory(req.category);
            if (req.holiday_group != null) existing.setHolidayGroup(req.holiday_group);
            if (req.shift_group != null) existing.setShiftGroup(req.shift_group);
            if (req.shift_roster != null) existing.setShiftRoster(req.shift_roster);
            if (req.geofence != null) existing.setGeofence(req.geofence);
            if (req.device_expiry_rule_applicable != null) existing.setDeviceExpiryRuleApplicable(req.device_expiry_rule_applicable);
            if (req.verification_type != null) existing.setVerificationType(req.verification_type);
            if (req.expiry_start_date != null) existing.setExpiryStartDate(req.expiry_start_date);
            if (req.expiry_end_date != null) existing.setExpiryEndDate(req.expiry_end_date);

            employeeRepository.save(existing);

            Map<String, Object> data = new HashMap<>();
            data.put("message", "Employee updated successfully");
            return ok(data);

        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to update employee", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // DELETE /api/employees/:id — Remove employee
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteEmployee(@PathVariable("id") String id) {
        try {
            Optional<Employee> empOpt = employeeRepository.findById(id);
            if (empOpt.isEmpty()) {
                return err("Employee not found", HttpStatus.NOT_FOUND);
            }
            
            Employee existing = empOpt.get();
            employeeRepository.delete(existing);

            Map<String, Object> data = new HashMap<>();
            data.put("message", "Employee \"" + existing.getName() + "\" deleted");
            return ok(data);
        } catch (Exception e) {
            e.printStackTrace();
            return err("Failed to delete employee", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Request DTO definition
    public static class EmployeeRequest {
        public String id;
        public String name;
        public String department;
        public String role;
        public List<Double> descriptor;
        public String image;
        public String status;
        public String hibernate_start_date;
        public String hibernate_end_date;
        public String hibernate_reason;

        // Enterprise Info
        public String company;
        public String designation;
        public String gender;
        public String date_of_joining;
        public String date_of_confirmation;
        public String last_working_day;
        public String aadhaar_number;
        public String pan_number;
        public String card_number;
        public String phone_no;
        public String email;
        public String reporting_to;

        // replica fields
        public String device_code;
        public String sub_department;
        public String division;
        public String grade;
        public String team;
        public String location;
        public String employment_type;
        public String category;
        public String holiday_group;
        public String shift_group;
        public String shift_roster;
        public String geofence;
        public Boolean device_expiry_rule_applicable;
        public String verification_type;
        public String expiry_start_date;
        public String expiry_end_date;
    }
}
