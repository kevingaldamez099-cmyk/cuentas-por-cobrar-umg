using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace CuentasPorCobrar.Api.Controllers;

[ApiController]
[Route("api/historial")]
public class HistorialController(IConfiguration configuration) : ControllerBase
{
    // Los pagos heredan el archivo de su factura. No se modifica ningún importe.
    [HttpPut("archivo")]
    public async Task<IActionResult> Archivar(ArchivoEntrada entrada)
    {
        using var conexion = new SqlConnection(configuration.GetConnectionString("DefaultConnection"));
        await conexion.OpenAsync();
        using var comando = new SqlCommand("""
            UPDATE dbo.Facturas SET Archivada = @Archivada
            WHERE Archivada <> @Archivada
              AND EXISTS (SELECT 1 FROM dbo.Clientes c WHERE c.Id = dbo.Facturas.ClienteId AND c.Activo = 1);
            """, conexion);
        comando.Parameters.Add("@Archivada", SqlDbType.Bit).Value = entrada.Archivar!.Value;
        var cantidad = await comando.ExecuteNonQueryAsync();
        return Ok(new { cantidad, mensaje = entrada.Archivar.Value
            ? "Historial archivado. Los importes y saldos se conservan."
            : "Historial restaurado a las listas habituales." });
    }
}

public class ArchivoEntrada
{
    [Required]
    public bool? Archivar { get; set; }
}
