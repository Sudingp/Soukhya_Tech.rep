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
            Map(x => x.Name, "name").Not.Nullable().Length(100);
            Map(x => x.Department, "department").Not.Nullable().Length(50);
            Map(x => x.Role, "role").Not.Nullable().Length(100);
            Map(x => x.Descriptor, "descriptor").CustomType("StringClob").Not.Nullable();
            Map(x => x.DescriptorHash, "descriptor_hash").Not.Nullable().Length(64);
            Map(x => x.Image, "image").CustomType("StringClob").Nullable();
            Map(x => x.CreatedAt, "created_at").Not.Nullable();
            Map(x => x.UpdatedAt, "updated_at").Not.Nullable();
            Map(x => x.UpdatedBy, "updated_by").Length(50);
            Map(x => x.Version, "version").Not.Nullable();
            Map(x => x.Status, "status").Not.Nullable().Length(20);
            Map(x => x.HibernateStartDate, "hibernate_start_date").Nullable();
            Map(x => x.HibernateEndDate, "hibernate_end_date").Nullable();
            Map(x => x.HibernateReason, "hibernate_reason").Length(500).Nullable();
            Map(x => x.Company, "company").Nullable().Length(100);
            Map(x => x.Designation, "designation").Nullable().Length(100);
            Map(x => x.Gender, "gender").Nullable().Length(10);
            Map(x => x.DateOfJoining, "date_of_joining").Nullable();
            Map(x => x.DateOfConfirmation, "date_of_confirmation").Nullable();
            Map(x => x.LastWorkingDay, "last_working_day").Nullable();
            Map(x => x.AadhaarNumber, "aadhaar_number").Nullable();
            Map(x => x.PanNumber, "pan_number").Nullable();
            Map(x => x.CardNumber, "card_number").Nullable();
            Map(x => x.PhoneNo, "phone_no").Nullable();
            Map(x => x.Email, "email").Nullable().Length(100);
            Map(x => x.ReportingTo, "reporting_to").Nullable().Length(50);
            Map(x => x.DeviceCode, "device_code").Nullable().Length(50);
            Map(x => x.SubDepartment, "sub_department").Nullable().Length(100);
            Map(x => x.Division, "division").Nullable().Length(100);
            Map(x => x.Grade, "grade").Nullable().Length(50);
            Map(x => x.Team, "team").Nullable().Length(100);
            Map(x => x.Location, "location").Nullable().Length(100);
            Map(x => x.EmploymentType, "employment_type").Nullable().Length(20);
            Map(x => x.Category, "category").Nullable().Length(50);
            Map(x => x.HolidayGroup, "holiday_group").Nullable().Length(100);
            Map(x => x.ShiftGroup, "shift_group").Nullable().Length(100);
            Map(x => x.ShiftRoster, "shift_roster").Nullable().Length(100);
            Map(x => x.Geofence, "geofence").Nullable().Length(100);
            Map(x => x.DeviceExpiryRuleApplicable, "device_expiry_rule_applicable").Nullable();
            Map(x => x.VerificationType, "verification_type").Nullable().Length(100);
            Map(x => x.ExpiryStartDate, "expiry_start_date").Nullable();
            Map(x => x.ExpiryEndDate, "expiry_end_date").Nullable();
        }
    }
}
