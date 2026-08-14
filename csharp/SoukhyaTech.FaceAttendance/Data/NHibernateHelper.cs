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
            string configuredPath = configuration?["Database:Path"] ?? "database/attendance.db";
            string dbPath = ResolveDatabasePath(configuredPath);
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

        private static string ResolveDatabasePath(string configuredPath)
        {
            if (string.IsNullOrWhiteSpace(configuredPath))
                return Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "database", "attendance.db"));

            if (Path.IsPathRooted(configuredPath))
                return configuredPath;

            var candidates = new List<string>
            {
                Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), configuredPath)),
                Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configuredPath))
            };

            var current = Directory.GetCurrentDirectory();
            for (int i = 0; i < 8; i++)
            {
                candidates.Add(Path.GetFullPath(Path.Combine(current, configuredPath)));
                var parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }

            foreach (var candidate in candidates.Distinct())
            {
                var candidateDir = Path.GetDirectoryName(candidate);
                if (!string.IsNullOrEmpty(candidateDir) && Directory.Exists(candidateDir))
                {
                    if (File.Exists(candidate) || candidate.EndsWith("attendance.db", StringComparison.OrdinalIgnoreCase))
                        return candidate;
                }
            }

            var repoRoot = Directory.GetCurrentDirectory();
            for (int i = 0; i < 8; i++)
            {
                if (Directory.Exists(Path.Combine(repoRoot, "database")))
                    return Path.Combine(repoRoot, "database", Path.GetFileName(configuredPath));

                var parent = Directory.GetParent(repoRoot);
                if (parent == null) break;
                repoRoot = parent.FullName;
            }

            return Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), configuredPath));
        }

        public static ISession OpenSession(IConfiguration? configuration = null)
        {
            return GetSessionFactory(configuration).OpenSession();
        }
    }
}
