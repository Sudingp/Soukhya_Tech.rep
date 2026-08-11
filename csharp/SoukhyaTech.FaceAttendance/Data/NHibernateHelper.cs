using FluentNHibernate.Cfg;
using FluentNHibernate.Cfg.Db;
using NHibernate;
using NHibernate.Tool.hbm2ddl;
using SoukhyaTech.FaceAttendance.Mappings;
using ISession = NHibernate.ISession;

namespace SoukhyaTech.FaceAttendance.Data
{
    public static class NHibernateHelper
    {
        private static ISessionFactory? _sessionFactory;
        private static readonly object _lock = new();

        public static ISessionFactory GetSessionFactory(IConfiguration? configuration = null)
        {
            if (_sessionFactory == null)
            {
                lock (_lock)
                {
                    if (_sessionFactory == null)
                    {
                        _sessionFactory = BuildSessionFactory(configuration);
                    }
                }
            }
            return _sessionFactory;
        }

        private static ISessionFactory BuildSessionFactory(IConfiguration? configuration)
        {
            string dbPath = configuration?["Database:Path"] ?? "database/attendance.db";
            var dbDir = Path.GetDirectoryName(dbPath);
            if (!string.IsNullOrEmpty(dbDir) && !Directory.Exists(dbDir))
                Directory.CreateDirectory(dbDir);

            var fluentConfig = Fluently.Configure()
                .Database(SQLiteConfiguration.Standard.UsingFile(dbPath))
                .Mappings(m => m.FluentMappings.AddFromAssemblyOf<EmployeeMap>())
                .ExposeConfiguration(cfg =>
                {
                    // Use SchemaValidate instead of SchemaUpdate in production
                    new SchemaUpdate(cfg).Execute(false, true);
                });

            return fluentConfig.BuildSessionFactory();
        }

        public static ISession OpenSession(IConfiguration? configuration = null)
        {
            return GetSessionFactory(configuration).OpenSession();
        }
    }
}
