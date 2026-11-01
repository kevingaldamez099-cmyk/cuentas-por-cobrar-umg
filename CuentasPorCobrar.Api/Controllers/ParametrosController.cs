using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.ComponentModel.DataAnnotations;
using System.Data;

namespace CuentasPorCobrar.Api.Controllers;

[ApiController]
[Route("api/parametros")]
public class ParametrosController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ParametrosController(IConfiguration configuration)
    {
        _configuration = configuration;
    }



    [HttpPut]
    public async Task<IActionResult> Actualizar(ParametrosEntrada datos)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        const string sql = """
            UPDATE dbo.Parametros
            SET NombreNegocio = @Nombre,
                Telefono = @Telefono,
                Direccion = @Direccion,
                Nit = @Nit
            WHERE Id = 1;
            """;

        using var comando = new SqlCommand(sql, conexion);

        comando.Parameters.Add("@Nit", SqlDbType.NVarChar, 30)
            .Value = datos.Nit?.Trim() ?? "";

        comando.Parameters.Add("@Nombre", SqlDbType.NVarChar, 150)
            .Value = datos.NombreNegocio.Trim();

        comando.Parameters.Add("@Telefono", SqlDbType.NVarChar, 30)
            .Value = datos.Telefono?.Trim() ?? "";

        comando.Parameters.Add("@Direccion", SqlDbType.NVarChar, 250)
            .Value = datos.Direccion?.Trim() ?? "";

        var filas = await comando.ExecuteNonQueryAsync();

        if (filas == 0)
        {
            return NotFound(new
            {
                mensaje = "No existe la configuración del negocio."
            });
        }

        return Ok(new
        {
            mensaje = "Configuración actualizada correctamente."
        });
    }







    [HttpGet]
    public async Task<IActionResult> Obtener()
    {
        var cadena = _configuration.GetConnectionString("DefaultConnection");

        using var conexion = new SqlConnection(cadena);
        await conexion.OpenAsync();

        const string sql = """
            SELECT NombreNegocio, Moneda, Telefono, Direccion, Nit
            FROM dbo.Parametros
            WHERE Id = 1;
            """;

        using var comando = new SqlCommand(sql, conexion);
        using var lector = await comando.ExecuteReaderAsync();

        if (!await lector.ReadAsync())
        {
            return NotFound(new { mensaje = "No existe la configuración." });
        }

        return Ok(new
        {
            nombreNegocio = lector.GetString(0),
            moneda = lector.GetString(1),
            telefono = lector.GetString(2),
            direccion = lector.GetString(3),
            nit = lector.GetString(4)
        });
    }
}


public class ParametrosEntrada
{
    [StringLength(30)]
    public string? Nit { get; set; }

    [Required(ErrorMessage = "El nombre del negocio es obligatorio.")]
    [StringLength(150)]
    public string NombreNegocio { get; set; } = "";

    [StringLength(30)]
    public string? Telefono { get; set; }

    [StringLength(250)]
    public string? Direccion { get; set; }
}
