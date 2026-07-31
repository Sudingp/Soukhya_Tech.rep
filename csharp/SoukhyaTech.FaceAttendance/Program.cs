using Microsoft.Extensions.FileProviders;
using NHibernate;
using SoukhyaTech.FaceAttendance.Data;
using SoukhyaTech.FaceAttendance.Repositories;
using ISession = NHibernate.ISession;

var builder = WebApplication.CreateBuilder(args);

// Register CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register NHibernate ISessionFactory & ISession
builder.Services.AddSingleton<ISessionFactory>(sp =>
{
    return NHibernateHelper.GetSessionFactory(builder.Configuration);
});

builder.Services.AddScoped<ISession>(sp =>
{
    var sessionFactory = sp.GetRequiredService<ISessionFactory>();
    return sessionFactory.OpenSession();
});

// Register Repositories
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
builder.Services.AddScoped<IAttendanceRepository, AttendanceRepository>();

var app = builder.Build();

// Enable Swagger UI
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");

// Serve Static Files from public directory
string publicDir = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "public"));
if (!Directory.Exists(publicDir))
{
    publicDir = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "public"));
}

if (Directory.Exists(publicDir))
{
    var fileProvider = new PhysicalFileProvider(publicDir);
    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = fileProvider
    });
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = fileProvider
    });
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthorization();

app.MapControllers();

app.Run();
