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
        private static readonly object _lock = new object();

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
            string dbPath = configuration?["Database:Path"] ?? "";

            if (string.IsNullOrWhiteSpace(dbPath))
            {
                // Traverse up to find database directory or root
                string baseDir = AppContext.BaseDirectory;
                string candidatePath = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "database", "attendance.db"));
                
                if (File.Exists(candidatePath) || Directory.Exists(Path.GetDirectoryName(candidatePath)))
                {
                    dbPath = candidatePath;
                }
                else
                {
                    dbPath = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "database", "attendance.db"));
                }
            }

            var dbDir = Path.GetDirectoryName(dbPath);
            if (!string.IsNullOrEmpty(dbDir) && !Directory.Exists(dbDir))
            {
                Directory.CreateDirectory(dbDir);
            }

            var fluentConfig = Fluently.Configure()
                .Database(SQLiteConfiguration.Standard.UsingFile(dbPath))
                .Mappings(m => m.FluentMappings.AddFromAssemblyOf<EmployeeMap>())
                .ExposeConfiguration(cfg =>
                {
                    try
                    {
                        new SchemaUpdate(cfg).Execute(false, true);
                    }
                    catch
                    {
                        // Ignore schema update issues if tables already exist
                    }
                });

            return fluentConfig.BuildSessionFactory();
        }

        public static ISession OpenSession(IConfiguration? configuration = null)
        {
            return GetSessionFactory(configuration).OpenSession();
        }
    }
}
