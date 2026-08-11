using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using SoukhyaTech.FaceAttendance.Data;
using SoukhyaTech.FaceAttendance.Repositories;
using SoukhyaTech.FaceAttendance.Security;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ‚îÄ‚îÄ Configuration ‚îÄ‚îÄ
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "dev-secret-min-32-characters-long!!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SoukhyaTech";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "FaceAttendance";

// ‚îÄ‚îÄ JWT Auth ‚îÄ‚îÄ
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("ADMIN"));
    options.AddPolicy("AdminOrHr", policy => policy.RequireRole("ADMIN", "HR"));
    options.AddPolicy("AdminHrDevice", policy => policy.RequireRole("ADMIN", "HR", "DEVICE"));
    options.AddPolicy("AnyAuthenticated", policy => policy.RequireAuthenticatedUser());
});

// ‚îÄ‚îÄ CORS Whitelist ‚îÄ‚îÄ
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000", "http://localhost:5173" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("Whitelist", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// ‚îÄ‚îä Controllers + JSON ‚îÄ‚îÄ
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ‚îÄ‚îÄ NHibernate ‚îÄ‚îÄ
builder.Services.AddSingleton(sp => NHibernateHelper.GetSessionFactory(builder.Configuration));
builder.Services.AddScoped(sp =>
{
    var factory = sp.GetRequiredService<NHibernate.ISessionFactory>();
    return factory.OpenSession();
});

// ‚îÄ‚îÄ Repositories & Services ‚îÄ‚îÄ
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
builder.Services.AddScoped<IAttendanceRepository, AttendanceRepository>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<PiiEncryptionService>();

var app = builder.Build();

// ‚îÄ‚îÄ Middleware Pipeline ‚îÄ‚îÄ
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Whitelist");
app.UseAuthentication();
app.UseAuthorization();

// Static files
string publicDir = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "public"));
if (!Directory.Exists(publicDir))
    publicDir = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "public"));

if (Directory.Exists(publicDir))
{
    var fileProvider = new PhysicalFileProvider(publicDir);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.MapControllers();
app.Run();
