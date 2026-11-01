using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CuentasPorCobrar.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public AuthController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginEntrada datos)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        const string sql = """
            SELECT Id, Nombre, PasswordHash
            FROM dbo.Usuarios
            WHERE Usuario = @Usuario AND Activo = 1;
            """;

        using var comando = new SqlCommand(sql, conexion);

        comando.Parameters.Add("@Usuario", SqlDbType.NVarChar, 50)
            .Value = datos.Usuario.Trim();

        using var lector = await comando.ExecuteReaderAsync();

        if (!await lector.ReadAsync())
        {
            return Unauthorized(new
            {
                mensaje = "Usuario o contraseña incorrectos."
            });
        }

        var id = lector.GetInt32(0);
        var nombre = lector.GetString(1);
        var hash = lector.GetString(2);

        var resultado = new PasswordHasher<object>()
            .VerifyHashedPassword(new object(), hash, datos.Clave);

        if (resultado == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new
            {
                mensaje = "Usuario o contraseña incorrectos."
            });
        }

        var identidad = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, id.ToString()),
                new Claim(ClaimTypes.Name, nombre)
            },
            CookieAuthenticationDefaults.AuthenticationScheme);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identidad));

        return Ok(new { id, nombre });
    }

    [HttpGet("yo")]
    public IActionResult Yo()
    {
        return Ok(new
        {
            id = User.FindFirstValue(ClaimTypes.NameIdentifier),
            nombre = User.Identity?.Name
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(
            CookieAuthenticationDefaults.AuthenticationScheme);

        return Ok(new { mensaje = "Sesión cerrada." });
    }
}

public class LoginEntrada
{
    [Required]
    [StringLength(50)]
    public string Usuario { get; set; } = "";

    [Required]
    [StringLength(200)]
    public string Clave { get; set; } = "";
}