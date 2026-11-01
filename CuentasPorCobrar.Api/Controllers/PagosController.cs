using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CuentasPorCobrar.Api.Controllers;

[ApiController]
[Route("api/pagos")]
public class PagosController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public PagosController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    // Consulta los recibos registrados.
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        const string sql = """
            SELECT p.Id, p.FacturaId, c.Nombre, p.Fecha,
                   p.Monto, p.Metodo, p.Referencia, p.Anulado, f.Archivada
            FROM dbo.Pagos p
            JOIN dbo.Facturas f ON f.Id = p.FacturaId
            JOIN dbo.Clientes c ON c.Id = f.ClienteId
            WHERE c.Activo = 1
            ORDER BY p.Id DESC;
            """;

        using var comando = new SqlCommand(sql, conexion);
        using var lector = await comando.ExecuteReaderAsync();

        var pagos = new List<object>();

        while (await lector.ReadAsync())
        {
            pagos.Add(new
            {
                id = lector.GetInt32(0),
                facturaId = lector.GetInt32(1),
                cliente = lector.GetString(2),
                fecha = lector.GetDateTime(3),
                monto = lector.GetDecimal(4),
                metodo = lector.GetString(5),
                referencia = lector.GetString(6),
                anulado = lector.GetBoolean(7),
                archivado = lector.GetBoolean(8)
            });
        }

        return Ok(pagos);
    }







    // Anula el recibo y conserva su historial.
    [HttpPost("{id:int}/anular")]
    public async Task<IActionResult> Anular(
        int id, AnulacionEntrada datos)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync();

        using var buscarPago = new SqlCommand("""
            SELECT FacturaId
            FROM dbo.Pagos
            WHERE Id = @Id;
            """, conexion, transaccion);

        buscarPago.Parameters.Add("@Id", SqlDbType.Int).Value = id;

        var resultado = await buscarPago.ExecuteScalarAsync();

        if (resultado == null)
        {
            return NotFound(new { mensaje = "El pago no existe." });
        }

        var facturaId = (int)resultado;

        // Usa el mismo bloqueo que el registro de pagos.
        using var bloquearFactura = new SqlCommand("""
            SELECT Id
            FROM dbo.Facturas WITH (UPDLOCK, HOLDLOCK)
            WHERE Id = @Id;
            """, conexion, transaccion);

        bloquearFactura.Parameters.Add("@Id", SqlDbType.Int)
            .Value = facturaId;

        await bloquearFactura.ExecuteScalarAsync();

        using var comando = new SqlCommand("""
            UPDATE dbo.Pagos
            SET Anulado = 1,
                MotivoAnulacion = @Motivo,
                AnuladoEn = SYSUTCDATETIME()
            WHERE Id = @Id AND Anulado = 0;
            """, conexion, transaccion);

        comando.Parameters.Add("@Id", SqlDbType.Int).Value = id;

        comando.Parameters.Add("@Motivo", SqlDbType.NVarChar, 300)
            .Value = datos.Motivo.Trim();

        var filas = await comando.ExecuteNonQueryAsync();

        if (filas == 0)
        {
            return BadRequest(new
            {
                mensaje = "El pago ya estaba anulado."
            });
        }

        await transaccion.CommitAsync();

        return Ok(new
        {
            mensaje = "Pago anulado. El saldo se ha actualizado."
        });
    }




















    // Registra un abono sin superar el saldo pendiente.
    [HttpPost]
    public async Task<IActionResult> Crear(PagoEntrada datos)
    {
        if (datos.Fecha.Year < 2000 || datos.Fecha.Year > 2100)
        {
            return BadRequest(new { mensaje = "La fecha no es válida." });
        }

        if (datos.Monto != decimal.Round(datos.Monto, 2))
        {
            return BadRequest(new
            {
                mensaje = "El monto admite un máximo de dos decimales."
            });
        }

        if (datos.Metodo == "Deposito" &&
            string.IsNullOrWhiteSpace(datos.Referencia))
        {
            return BadRequest(new
            {
                mensaje = "El depósito necesita una referencia."
            });
        }

        if (!int.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier),
            out var usuarioId))
        {
            return Unauthorized();
        }

        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync();

        // Bloquea esta factura mientras se comprueba y registra el pago.
        using var consultarFactura = new SqlCommand("""
            SELECT Anulada, Fecha
            FROM dbo.Facturas WITH (UPDLOCK, HOLDLOCK)
            WHERE Id = @Id;
            """, conexion, transaccion);

        consultarFactura.Parameters.Add("@Id", SqlDbType.Int)
            .Value = datos.FacturaId;

        using (var lector = await consultarFactura.ExecuteReaderAsync())
        {
            if (!await lector.ReadAsync())
            {
                return NotFound(new { mensaje = "La factura no existe." });
            }

            if (lector.GetBoolean(0))
            {
                return BadRequest(new
                {
                    mensaje = "No se puede pagar una factura anulada."
                });
            }

            if (datos.Fecha.Date < lector.GetDateTime(1).Date)
            {
                return BadRequest(new
                {
                    mensaje = "El pago no puede ser anterior a la factura."
                });
            }
        }

        using var consultarSaldo = new SqlCommand("""
            SELECT Saldo
            FROM dbo.vw_EstadoFacturas
            WHERE Id = @Id;
            """, conexion, transaccion);

        consultarSaldo.Parameters.Add("@Id", SqlDbType.Int)
            .Value = datos.FacturaId;

        var saldo = (decimal)(await consultarSaldo.ExecuteScalarAsync())!;

        if (datos.Monto > saldo)
        {
            return BadRequest(new
            {
                mensaje = "El pago supera el saldo pendiente.",
                saldo
            });
        }

        const string sql = """
            INSERT INTO dbo.Pagos
                (FacturaId, Fecha, Monto, Metodo, Referencia, UsuarioId)
            OUTPUT INSERTED.Id
            VALUES
                (@FacturaId, @Fecha, @Monto, @Metodo, @Referencia, @UsuarioId);
            """;

        using var comando = new SqlCommand(sql, conexion, transaccion);

        comando.Parameters.Add("@FacturaId", SqlDbType.Int)
            .Value = datos.FacturaId;

        comando.Parameters.Add("@Fecha", SqlDbType.Date)
            .Value = datos.Fecha.Date;

        var monto = comando.Parameters.Add("@Monto", SqlDbType.Decimal);
        monto.Precision = 18;
        monto.Scale = 2;
        monto.Value = datos.Monto;

        comando.Parameters.Add("@Metodo", SqlDbType.NVarChar, 20)
            .Value = datos.Metodo;

        comando.Parameters.Add("@Referencia", SqlDbType.NVarChar, 100)
            .Value = datos.Referencia?.Trim() ?? "";

        comando.Parameters.Add("@UsuarioId", SqlDbType.Int)
            .Value = usuarioId;

        var id = (int)(await comando.ExecuteScalarAsync())!;

        await transaccion.CommitAsync();

        return StatusCode(201, new
        {
            id,
            mensaje = "Pago registrado correctamente.",
            saldoPendiente = saldo - datos.Monto
        });
    }
}

public class PagoEntrada
{
    [Range(1, int.MaxValue)]
    public int FacturaId { get; set; }

    public DateTime Fecha { get; set; }

    [Range(typeof(decimal), "0.01", "1000000000000")]
    public decimal Monto { get; set; }

    [Required]
    [RegularExpression("^(Efectivo|Deposito)$",
        ErrorMessage = "El método debe ser Efectivo o Deposito.")]
    public string Metodo { get; set; } = "Efectivo";

    [StringLength(100)]
    public string? Referencia { get; set; }


    





public class AnulacionEntrada
{
    [Required(ErrorMessage = "Debes indicar el motivo.")]
    [StringLength(300)]
    public string Motivo { get; set; } = "";
}






}
