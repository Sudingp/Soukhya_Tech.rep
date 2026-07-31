using FluentNHibernate.Mapping;
using SoukhyaTech.FaceAttendance.Models;

namespace SoukhyaTech.FaceAttendance.Mappings
{
    public class EmployeeMap : ClassMap<Employee>
    {
        public EmployeeMap()
        {
            Table("employees");

            Id(x => x.Id, "id").GeneratedBy.Assigned();

            Map(x => x.Name, "name").Not.Nullable();
            Map(x => x.Department, "department").Not.Nullable();
            Map(x => x.Role, "role").Not.Nullable();
            Map(x => x.Descriptor, "descriptor").CustomType("StringClob").Not.Nullable();
            Map(x => x.Image, "image").CustomType("StringClob").Nullable();
            Map(x => x.CreatedAt, "created_at").Not.Nullable();
            Map(x => x.Status, "status").Nullable();

            // Hibernate Mode columns
            Map(x => x.HibernateStartDate, "hibernate_start_date").Nullable();
            Map(x => x.HibernateEndDate, "hibernate_end_date").Nullable();
            Map(x => x.HibernateReason, "hibernate_reason").Nullable();

            // Enterprise HR columns
            Map(x => x.Company, "company").Nullable();
            Map(x => x.Designation, "designation").Nullable();
            Map(x => x.Gender, "gender").Nullable();
            Map(x => x.DateOfJoining, "date_of_joining").Nullable();
            Map(x => x.DateOfConfirmation, "date_of_confirmation").Nullable();
            Map(x => x.LastWorkingDay, "last_working_day").Nullable();
            Map(x => x.AadhaarNumber, "aadhaar_number").Nullable();
            Map(x => x.PanNumber, "pan_number").Nullable();
            Map(x => x.CardNumber, "card_number").Nullable();
            Map(x => x.PhoneNo, "phone_no").Nullable();
            Map(x => x.Email, "email").Nullable();
            Map(x => x.ReportingTo, "reporting_to").Nullable();
            Map(x => x.DeviceCode, "device_code").Nullable();
            Map(x => x.SubDepartment, "sub_department").Nullable();
            Map(x => x.Division, "division").Nullable();
            Map(x => x.Grade, "grade").Nullable();
            Map(x => x.Team, "team").Nullable();
            Map(x => x.Location, "location").Nullable();
            Map(x => x.EmploymentType, "employment_type").Nullable();
            Map(x => x.Category, "category").Nullable();
            Map(x => x.HolidayGroup, "holiday_group").Nullable();
            Map(x => x.ShiftGroup, "shift_group").Nullable();
            Map(x => x.ShiftRoster, "shift_roster").Nullable();
            Map(x => x.Geofence, "geofence").Nullable();
            Map(x => x.DeviceExpiryRuleApplicable, "device_expiry_rule_applicable").Nullable();
            Map(x => x.VerificationType, "verification_type").Nullable();
            Map(x => x.ExpiryStartDate, "expiry_start_date").Nullable();
            Map(x => x.ExpiryEndDate, "expiry_end_date").Nullable();
        }
    }
}
