using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using System.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opciones =>
    {
        opciones.Cookie.Name = "CuentasPorCobrar.Sesion";
        opciones.Cookie.HttpOnly = true;
        opciones.Cookie.SameSite = SameSiteMode.Strict;
        opciones.ExpireTimeSpan = TimeSpan.FromHours(2);

        // Una API devuelve un estado HTTP, no una página de acceso.
        opciones.Events.OnRedirectToLogin = contexto =>
        {
            contexto.Response.StatusCode = 401;
            return Task.CompletedTask;
        };

        opciones.Events.OnRedirectToAccessDenied = contexto =>
        {
            contexto.Response.StatusCode = 403;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Crea el administrador solo si todavía no hay usuarios.
using (var conexion = new SqlConnection(
    builder.Configuration.GetConnectionString("DefaultConnection")))
{
    await conexion.OpenAsync();

    using var prepararArchivo = new SqlCommand("""
        IF COL_LENGTH('dbo.Facturas', 'Archivada') IS NULL
            ALTER TABLE dbo.Facturas ADD Archivada bit NOT NULL
                CONSTRAINT DF_Facturas_Archivada DEFAULT 0;
        """, conexion);
    await prepararArchivo.ExecuteNonQueryAsync();

    using var prepararNit = new SqlCommand("""
        IF COL_LENGTH('dbo.Parametros', 'Nit') IS NULL
            ALTER TABLE dbo.Parametros ADD Nit nvarchar(30) NOT NULL
                CONSTRAINT DF_Parametros_Nit DEFAULT N'';
        """, conexion);
    await prepararNit.ExecuteNonQueryAsync();

    using var consulta = new SqlCommand(
        "SELECT COUNT(*) FROM dbo.Usuarios;", conexion);

    var cantidad = (int)(await consulta.ExecuteScalarAsync())!;

    if (cantidad == 0)
    {
        var clave = Environment.GetEnvironmentVariable("CC_ADMIN_PASSWORD");

        if (string.IsNullOrWhiteSpace(clave) || clave.Length < 10)
        {
            throw new InvalidOperationException(
                "Define CC_ADMIN_PASSWORD con al menos 10 caracteres.");
        }

        var hash = new PasswordHasher<object>()
            .HashPassword(new object(), clave);

        const string sql = """
            INSERT INTO dbo.Usuarios (Nombre, Usuario, PasswordHash)
            VALUES (N'Administrador', N'admin', @Hash);
            """;

        using var comando = new SqlCommand(sql, conexion);
        comando.Parameters.Add("@Hash", SqlDbType.NVarChar, 500)
            .Value = hash;

        await comando.ExecuteNonQueryAsync();
    }
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

// Todos los controladores requieren sesión,
// excepto los marcados explícitamente como públicos.
app.MapControllers().RequireAuthorization();



app.MapFallbackToFile("index.html");
app.Run();
