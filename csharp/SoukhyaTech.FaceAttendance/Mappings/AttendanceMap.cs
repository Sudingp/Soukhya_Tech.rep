using FluentNHibernate.Mapping;
using SoukhyaTech.FaceAttendance.Models;

namespace SoukhyaTech.FaceAttendance.Mappings
{
    public class AttendanceMap : ClassMap<Attendance>
    {
        public AttendanceMap()
        {
            Table("attendance");
            Id(x => x.AttId, "att_id").GeneratedBy.Native();
            Map(x => x.EmpId, "emp_id").Not.Nullable().Length(20);
            Map(x => x.Name, "name").Not.Nullable().Length(100);
            Map(x => x.Dept, "dept").Not.Nullable().Length(50);
            Map(x => x.Role, "role").Not.Nullable().Length(100);
            Map(x => x.Timestamp, "timestamp").Not.Nullable();
            Map(x => x.Status, "status").Not.Nullable().Length(10);
            Map(x => x.LoggedBy, "logged_by").Nullable().Length(50);
            Map(x => x.IpAddress, "ip_address").Nullable().Length(45);
            Map(x => x.UserAgent, "user_agent").Nullable().Length(255);
        }
    }
}
