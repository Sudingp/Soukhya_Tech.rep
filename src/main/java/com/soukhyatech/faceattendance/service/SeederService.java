package com.soukhyatech.faceattendance.service;

import com.soukhyatech.faceattendance.model.Employee;
import com.soukhyatech.faceattendance.repository.EmployeeRepository;
import com.soukhyatech.faceattendance.repository.AttendanceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class SeederService {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void onStartup() {
        seedDatabase();
    }

    @Transactional
    public void resetAndSeed() {
        System.out.println("  [SEEDER] Manual request to Reset and Seed database...");
        attendanceRepository.deleteAll();
        employeeRepository.deleteAll();
        seedDatabase();
    }

    @Transactional
    public void seedDatabase() {
        if (employeeRepository.count() > 0) {
            System.out.println("  [SEEDER] Database already has employee records. Skipping seeder.");
            return;
        }

        System.out.println("  [SEEDER] Seeding 100 realistic employee records...");

        String[] firstNames = {"John", "Jane", "Robert", "Mary", "William", "David", "James", "Patricia", "Michael", "Linda", "Elizabeth", "Barbara", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian", "George"};
        String[] lastNames = {"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"};

        String[] depts = {"Engineering", "HR", "Finance", "Marketing", "Operations", "Sales", "IT"};
        
        // Companies from eTimeTrackLite screenshot
        String[] companies = {"KRIDE", "GC", "Default"};

        Map<String, String[]> rolesByDept = new HashMap<>();
        rolesByDept.put("Engineering", new String[]{"Software Engineer", "Senior Engineer", "Engineering Manager", "Frontend Developer", "Backend Developer", "QA Analyst", "DevOps Specialist"});
        rolesByDept.put("HR", new String[]{"HR Generalist", "Recruiter", "HR Manager", "Talent Acquisition Specialist", "HR Coordinator"});
        rolesByDept.put("Finance", new String[]{"Financial Analyst", "Accountant", "Finance Manager", "Billing Specialist", "Controller"});
        rolesByDept.put("Marketing", new String[]{"Marketing Specialist", "Content Strategist", "Marketing Manager", "SEO Analyst", "Social Coordinator"});
        rolesByDept.put("Operations", new String[]{"Operations Analyst", "Operations Manager", "Logistics Coordinator", "Project Manager", "Office Administrator"});
        rolesByDept.put("Sales", new String[]{"Account Executive", "Sales Manager", "Sales Specialist", "Business Representative", "Client Partner"});
        rolesByDept.put("IT", new String[]{"System Administrator", "IT Support Specialist", "Network Engineer", "IT Infrastructure Manager", "Security Analyst"});

        String[] hibernateReasons = {
            "Sabbatical for advanced higher education and professional certifications",
            "Temporary health and medical recovery period",
            "Extended personal leave for family commitments",
            "Career transition and external research secondment",
            "Relocation transition and adjustment period",
            "External incubation or startup venture exploration",
            "Military deployment or local defense training commitment"
        };

        // Create target distribution: 75 Active, 10 Hibernate, 10 On Leave, 5 Resigned
        List<String> statuses = new ArrayList<>();
        for (int i = 0; i < 75; i++) statuses.add("Active");
        for (int i = 0; i < 10; i++) statuses.add("Hibernate");
        for (int i = 0; i < 10; i++) statuses.add("On Leave");
        for (int i = 0; i < 5; i++) statuses.add("Resigned");

        Set<String> usedNames = new HashSet<>();
        List<Employee> employeesToPersist = new ArrayList<>();
        Random rand = new Random();

        for (int i = 1; i <= 100; i++) {
            String id = "EMP" + String.format("%03d", i);

            // Select unique name
            String firstName = firstNames[rand.nextInt(firstNames.length)];
            String lastName = lastNames[rand.nextInt(lastNames.length)];
            String fullName = firstName + " " + lastName;
            int nameAttempts = 0;
            while (usedNames.contains(fullName) && nameAttempts < 100) {
                firstName = firstNames[rand.nextInt(firstNames.length)];
                lastName = lastNames[rand.nextInt(lastNames.length)];
                fullName = firstName + " " + lastName;
                nameAttempts++;
            }
            usedNames.add(fullName);

            String dept = depts[rand.nextInt(depts.length)];
            String[] deptRoles = rolesByDept.get(dept);
            String role = deptRoles[rand.nextInt(deptRoles.length)];

            String status = statuses.get(i - 1);
            String hibernateStartDate = null;
            String hibernateEndDate = null;
            String hibernateReason = null;

            if ("Hibernate".equals(status)) {
                // Generate a random month between Jan (01) and May (05) 2026
                int startMonth = rand.nextInt(5) + 1;
                int startDay = rand.nextInt(28) + 1;
                hibernateStartDate = String.format("2026-%02d-%02d", startMonth, startDay);

                int durationMonths = rand.nextInt(3) + 2; // 2 to 4 months duration
                int endMonth = startMonth + durationMonths;
                int endDay = rand.nextInt(28) + 1;
                hibernateEndDate = String.format("2026-%02d-%02d", endMonth, endDay);
                
                hibernateReason = hibernateReasons[rand.nextInt(hibernateReasons.length)];
            }

            // Generate random unit vector descriptors (128 dimensions)
            List<Double> descriptorList = new ArrayList<>();
            for (int j = 0; j < 128; j++) {
                descriptorList.add((rand.nextDouble() - 0.5) * 0.15);
            }
            
            // Convert to JSON array string
            StringBuilder descriptorStr = new StringBuilder("[");
            for (int j = 0; j < descriptorList.size(); j++) {
                descriptorStr.append(descriptorList.get(j));
                if (j < descriptorList.size() - 1) {
                    descriptorStr.append(",");
                }
            }
            descriptorStr.append("]");

            // ── GENERATE ENTERPRISE VALUES ──
            String company = companies[rand.nextInt(companies.length)];
            String designation = role;
            String gender = rand.nextBoolean() ? "Male" : "Female";

            // Date of Joining: random date in 2024 or 2025
            int joinYear = 2024 + rand.nextInt(2);
            int joinMonth = rand.nextInt(12) + 1;
            int joinDay = rand.nextInt(28) + 1;
            String dateOfJoining = String.format("%04d-%02d-%02d", joinYear, joinMonth, joinDay);

            // Date of Confirmation: joining date + 6 months
            int confMonth = joinMonth + 6;
            int confYear = joinYear;
            if (confMonth > 12) {
                confMonth -= 12;
                confYear += 1;
            }
            String dateOfConfirmation = String.format("%04d-%02d-%02d", confYear, confMonth, joinDay);

            // Last Working Day: 3000-01-01 for active, recent date for resigned
            String lastWorkingDay = "3000-01-01";
            if ("Resigned".equals(status)) {
                // Resigned date sometime in 2026
                lastWorkingDay = String.format("2026-%02d-%02d", rand.nextInt(5) + 1, rand.nextInt(28) + 1);
            }

            // Aadhaar: 12-digit string
            String aadhaarNumber = String.format("%04d-%04d-%04d", 
                    rand.nextInt(9000) + 1000, 
                    rand.nextInt(9000) + 1000, 
                    rand.nextInt(9000) + 1000);

            // PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
            StringBuilder panBuilder = new StringBuilder();
            for (int k = 0; k < 5; k++) panBuilder.append((char) ('A' + rand.nextInt(26)));
            panBuilder.append(String.format("%04d", rand.nextInt(10000)));
            panBuilder.append((char) ('A' + rand.nextInt(26)));
            String panNumber = panBuilder.toString();

            // Card Number: KCC + 5 digits
            String cardNumber = "KCC" + String.format("%05d", 10000 + rand.nextInt(90000));

            // Phone: +91 9xxxx xxxxx
            String phoneNo = "+91 " + (70000 + rand.nextInt(30000)) + " " + String.format("%05d", rand.nextInt(100000));

            // Email
            String email = (firstName + "." + lastName).toLowerCase() + "@" + company.toLowerCase() + ".com";

            // Reporting To (Supervisor)
            String reportingTo = "EMP001";
            if (i > 5) {
                reportingTo = "EMP" + String.format("%03d", rand.nextInt(5) + 1);
            }

            // Replica fields details
            String deviceCode = "KCC" + String.format("%03d", i);
            String[] subDepts = {"P&D", "QA Testing", "Operations Team", "Talent Acquisition", "Accounts", "None"};
            String subDepartment = subDepts[rand.nextInt(subDepts.length)];
            String division = rand.nextBoolean() ? "Division " + (char)('A' + rand.nextInt(3)) : "None";
            String[] grades = {"G1", "G2", "G3", "G4", "Grade A", "Grade B"};
            String grade = grades[rand.nextInt(grades.length)];
            String[] teams = {"Team Alpha", "Team Beta", "Team Delta", "None"};
            String team = teams[rand.nextInt(teams.length)];
            String[] locations = {"HQ - Bangalore", "Branch - Mumbai", "Branch - Chennai", "Delhi Office"};
            String location = locations[rand.nextInt(locations.length)];
            String employmentType = "Permanent"; // Matching the screenshot's default
            if (rand.nextInt(10) > 7) {
                employmentType = "Temporary";
            }
            String[] cats = {"Default", "Staff", "Management"};
            String category = cats[rand.nextInt(cats.length)];
            String holidayGroup = "None";
            if (rand.nextBoolean()) holidayGroup = "General Holidays";
            String shiftGroup = "None";
            if (rand.nextBoolean()) shiftGroup = "General Shift Group";
            String shiftRoster = "None";
            if (rand.nextBoolean()) shiftRoster = "Standard Roster";
            String geofence = "--Select--";
            if (rand.nextBoolean()) geofence = "HQ Geofence";
            Boolean deviceExpiryRuleApplicable = rand.nextBoolean();
            String verificationType = "Finger or Face or Card or Pin";
            String expiryStartDate = "2000-01-01";
            String expiryEndDate = "2030-12-31";

            Employee emp = Employee.builder()
                    .id(id)
                    .name(fullName)
                    .department(dept)
                    .role(role)
                    .descriptor(descriptorStr.toString())
                    .image(null)
                    .status(status)
                    .hibernateStartDate(hibernateStartDate)
                    .hibernateEndDate(hibernateEndDate)
                    .hibernateReason(hibernateReason)
                    .company(company)
                    .designation(designation)
                    .gender(gender)
                    .dateOfJoining(dateOfJoining)
                    .dateOfConfirmation(dateOfConfirmation)
                    .lastWorkingDay(lastWorkingDay)
                    .aadhaarNumber(aadhaarNumber)
                    .panNumber(panNumber)
                    .cardNumber(cardNumber)
                    .phoneNo(phoneNo)
                    .email(email)
                    .reportingTo(reportingTo)
                    
                    // replica fields
                    .deviceCode(deviceCode)
                    .subDepartment(subDepartment)
                    .division(division)
                    .grade(grade)
                    .team(team)
                    .location(location)
                    .employmentType(employmentType)
                    .category(category)
                    .holidayGroup(holidayGroup)
                    .shiftGroup(shiftGroup)
                    .shiftRoster(shiftRoster)
                    .geofence(geofence)
                    .deviceExpiryRuleApplicable(deviceExpiryRuleApplicable)
                    .verificationType(verificationType)
                    .expiryStartDate(expiryStartDate)
                    .expiryEndDate(expiryEndDate)
                    .build();

            employeesToPersist.add(emp);
        }

        employeeRepository.saveAll(employeesToPersist);
        System.out.println("  [SEEDER] Successfully seeded 100 employees with detailed replica profiles");
    }
}
