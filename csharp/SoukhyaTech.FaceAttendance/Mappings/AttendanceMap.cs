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

            Map(x => x.EmpId, "emp_id").Not.Nullable();
            Map(x => x.Name, "name").Not.Nullable();
            Map(x => x.Dept, "dept").Not.Nullable();
            Map(x => x.Role, "role").Not.Nullable();
            Map(x => x.Timestamp, "timestamp").Not.Nullable();
            Map(x => x.Status, "status").Not.Nullable();
        }
    }
}
