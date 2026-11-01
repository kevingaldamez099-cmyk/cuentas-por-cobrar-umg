using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CuentasPorCobrar.Api.Controllers;

[ApiController]
[Route("api/estados-cuenta")]
public class EstadosCuentaController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public EstadosCuentaController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("{clienteId:int}")]
    public async Task<IActionResult> Consultar(int clienteId)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        // Mantiene consistente el reporte mientras se consultan sus partes.
        using var transaccion = (SqlTransaction)
            await conexion.BeginTransactionAsync(IsolationLevel.Serializable);

        object cliente;

        using (var comando = new SqlCommand("""
            SELECT Id, Nombre, Nit, Telefono, Correo
            FROM dbo.Clientes
            WHERE Id = @ClienteId AND Activo = 1;
            """, conexion, transaccion))
        {
            comando.Parameters.Add("@ClienteId", SqlDbType.Int)
                .Value = clienteId;

            using var lector = await comando.ExecuteReaderAsync();

            if (!await lector.ReadAsync())
            {
                return NotFound(new
                {
                    mensaje = "El cliente no existe o está inactivo. Reactívalo desde Clientes para consultar su estado de cuenta."
                });
            }

            cliente = new
            {
                id = lector.GetInt32(0),
                nombre = lector.GetString(1),
                nit = lector.GetString(2),
                telefono = lector.GetString(3),
                correo = lector.GetString(4)
            };
        }

        var facturas = new List<object>();
        decimal totalFacturadoVigente = 0;
        decimal totalPagadoVigente = 0;
        decimal saldoPendiente = 0;

        using (var comando = new SqlCommand("""
            SELECT Id, Fecha, Vencimiento,
                   Total, Pagado, Saldo, Anulada
            FROM dbo.vw_EstadoFacturas
            WHERE ClienteId = @ClienteId
            ORDER BY Fecha, Id;
            """, conexion, transaccion))
        {
            comando.Parameters.Add("@ClienteId", SqlDbType.Int)
                .Value = clienteId;

            using var lector = await comando.ExecuteReaderAsync();

            while (await lector.ReadAsync())
            {
                var total = lector.GetDecimal(3);
                var pagado = lector.GetDecimal(4);
                var saldo = lector.GetDecimal(5);
                var anulada = lector.GetBoolean(6);

                if (!anulada)
                {
                    totalFacturadoVigente += total;
                    totalPagadoVigente += pagado;
                    saldoPendiente += saldo;
                }

                facturas.Add(new
                {
                    id = lector.GetInt32(0),
                    fecha = lector.GetDateTime(1),
                    vencimiento = lector.GetDateTime(2),
                    total,
                    pagado,
                    saldo,
                    anulada
                });
            }
        }

        var pagos = new List<object>();

        using (var comando = new SqlCommand("""
            SELECT p.Id, p.FacturaId, p.Fecha, p.Monto,
                   p.Metodo, p.Referencia, p.Anulado,
                   p.MotivoAnulacion
            FROM dbo.Pagos p
            JOIN dbo.Facturas f ON f.Id = p.FacturaId
            WHERE f.ClienteId = @ClienteId
            ORDER BY p.Fecha, p.Id;
            """, conexion, transaccion))
        {
            comando.Parameters.Add("@ClienteId", SqlDbType.Int)
                .Value = clienteId;

            using var lector = await comando.ExecuteReaderAsync();

            while (await lector.ReadAsync())
            {
                pagos.Add(new
                {
                    id = lector.GetInt32(0),
                    facturaId = lector.GetInt32(1),
                    fecha = lector.GetDateTime(2),
                    monto = lector.GetDecimal(3),
                    metodo = lector.GetString(4),
                    referencia = lector.GetString(5),
                    anulado = lector.GetBoolean(6),
                    motivoAnulacion = lector.IsDBNull(7)
                        ? null
                        : lector.GetString(7)
                });
            }
        }

        await transaccion.CommitAsync();

        return Ok(new
        {
            cliente,
            resumen = new
            {
                totalFacturadoVigente,
                totalPagadoVigente,
                saldoPendiente
            },
            facturas,
            pagos
        });
    }
}
