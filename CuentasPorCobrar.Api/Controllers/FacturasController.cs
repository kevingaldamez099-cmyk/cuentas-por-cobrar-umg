using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CuentasPorCobrar.Api.Controllers;

[ApiController]
[Route("api/facturas")]
public class FacturasController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public FacturasController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    // Consulta facturas y sus saldos.
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        const string sql = """
            SELECT Id, ClienteId, Cliente, Fecha, Vencimiento,
                   Total, Pagado, Saldo, Anulada,
                   (SELECT Archivada FROM dbo.Facturas f WHERE f.Id = v.Id) AS Archivada
            FROM dbo.vw_EstadoFacturas v
            WHERE EXISTS (SELECT 1 FROM dbo.Clientes c WHERE c.Id = v.ClienteId AND c.Activo = 1)
            ORDER BY Id DESC;
            """;

        using var comando = new SqlCommand(sql, conexion);
        using var lector = await comando.ExecuteReaderAsync();

        var facturas = new List<object>();

        while (await lector.ReadAsync())
        {
            facturas.Add(new
            {
                id = lector.GetInt32(0),
                clienteId = lector.GetInt32(1),
                cliente = lector.GetString(2),
                fecha = lector.GetDateTime(3),
                vencimiento = lector.GetDateTime(4),
                total = lector.GetDecimal(5),
                pagado = lector.GetDecimal(6),
                saldo = lector.GetDecimal(7),
                anulada = lector.GetBoolean(8),
                archivada = lector.GetBoolean(9)
            });
        }

        return Ok(facturas);
    }






    // Anula una factura que no tenga pagos vigentes.
    [HttpPost("{id:int}/anular")]
    public async Task<IActionResult> Anular(
        int id, AnulacionEntrada datos)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        using var transaccion =
            (SqlTransaction)await conexion.BeginTransactionAsync();

        using var buscar = new SqlCommand("""
            SELECT Anulada
            FROM dbo.Facturas WITH (UPDLOCK, HOLDLOCK)
            WHERE Id = @Id;
            """, conexion, transaccion);

        buscar.Parameters.Add("@Id", SqlDbType.Int).Value = id;

        var resultado = await buscar.ExecuteScalarAsync();

        if (resultado == null)
        {
            return NotFound(new { mensaje = "La factura no existe." });
        }

        if ((bool)resultado)
        {
            return BadRequest(new
            {
                mensaje = "La factura ya estaba anulada."
            });
        }

        using var consultarPagos = new SqlCommand("""
            SELECT COUNT(*)
            FROM dbo.Pagos
            WHERE FacturaId = @Id AND Anulado = 0;
            """, conexion, transaccion);

        consultarPagos.Parameters.Add("@Id", SqlDbType.Int).Value = id;

        var pagosVigentes =
            (int)(await consultarPagos.ExecuteScalarAsync())!;

        if (pagosVigentes > 0)
        {
            return BadRequest(new
            {
                mensaje = "Primero debes anular los pagos de esta factura."
            });
        }

        using var comando = new SqlCommand("""
            UPDATE dbo.Facturas
            SET Anulada = 1,
                MotivoAnulacion = @Motivo,
                AnuladaEn = SYSUTCDATETIME()
            WHERE Id = @Id;
            """, conexion, transaccion);

        comando.Parameters.Add("@Id", SqlDbType.Int).Value = id;

        comando.Parameters.Add("@Motivo", SqlDbType.NVarChar, 300)
            .Value = datos.Motivo.Trim();

        await comando.ExecuteNonQueryAsync();
        await transaccion.CommitAsync();

        return Ok(new { mensaje = "Factura anulada correctamente." });
    }





















    // Guarda el encabezado y los detalles juntos.
    [HttpPost]
    public async Task<IActionResult> Crear(FacturaEntrada datos)
    {
        if (datos.Fecha.Year < 2000 || datos.Fecha.Year > 2100 ||
            datos.Vencimiento.Year < 2000 ||
            datos.Vencimiento.Year > 2100 ||
            datos.Vencimiento.Date < datos.Fecha.Date)
        {
            return BadRequest(new
            {
                mensaje = "Revisa las fechas: el vencimiento no puede ser anterior a la factura."
            });
        }

        if (datos.Detalles == null ||
            datos.Detalles.Count < 1 ||
            datos.Detalles.Count > 50)
        {
            return BadRequest(new
            {
                mensaje = "La factura debe tener entre 1 y 50 detalles."
            });
        }

        foreach (var detalle in datos.Detalles)
        {
            if (detalle == null ||
                detalle.Cantidad != decimal.Round(detalle.Cantidad, 2) ||
                detalle.PrecioUnitario != decimal.Round(detalle.PrecioUnitario, 2))
            {
                return BadRequest(new
                {
                    mensaje = "Usa detalles válidos y un máximo de dos decimales."
                });
            }
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

        // Comprueba que el cliente exista y esté activo.
        using var validarCliente = new SqlCommand("""
            SELECT Id
            FROM dbo.Clientes WITH (UPDLOCK, HOLDLOCK)
            WHERE Id = @ClienteId AND Activo = 1;
            """, conexion, transaccion);

        validarCliente.Parameters.Add("@ClienteId", SqlDbType.Int)
            .Value = datos.ClienteId;

        if (await validarCliente.ExecuteScalarAsync() == null)
        {
            return BadRequest(new
            {
                mensaje = "El cliente no existe o está inactivo."
            });
        }

        const string sqlFactura = """
            INSERT INTO dbo.Facturas
                (ClienteId, Fecha, Vencimiento, Observaciones, UsuarioId)
            OUTPUT INSERTED.Id
            VALUES
                (@ClienteId, @Fecha, @Vencimiento, @Observaciones, @UsuarioId);
            """;

        using var comando = new SqlCommand(
            sqlFactura, conexion, transaccion);

        comando.Parameters.Add("@ClienteId", SqlDbType.Int)
            .Value = datos.ClienteId;

        comando.Parameters.Add("@Fecha", SqlDbType.Date)
            .Value = datos.Fecha.Date;

        comando.Parameters.Add("@Vencimiento", SqlDbType.Date)
            .Value = datos.Vencimiento.Date;

        comando.Parameters.Add("@Observaciones", SqlDbType.NVarChar, 500)
            .Value = datos.Observaciones?.Trim() ?? "";

        comando.Parameters.Add("@UsuarioId", SqlDbType.Int)
            .Value = usuarioId;

        var facturaId = (int)(await comando.ExecuteScalarAsync())!;

        foreach (var detalle in datos.Detalles)
        {
            const string sqlDetalle = """
                INSERT INTO dbo.DetallesFactura
                    (FacturaId, Descripcion, Cantidad, PrecioUnitario)
                VALUES
                    (@FacturaId, @Descripcion, @Cantidad, @Precio);
                """;

            using var insertar = new SqlCommand(
                sqlDetalle, conexion, transaccion);

            insertar.Parameters.Add("@FacturaId", SqlDbType.Int)
                .Value = facturaId;

            insertar.Parameters.Add("@Descripcion", SqlDbType.NVarChar, 200)
                .Value = detalle.Descripcion.Trim();

            var cantidad = insertar.Parameters.Add(
                "@Cantidad", SqlDbType.Decimal);
            cantidad.Precision = 12;
            cantidad.Scale = 2;
            cantidad.Value = detalle.Cantidad;

            var precio = insertar.Parameters.Add(
                "@Precio", SqlDbType.Decimal);
            precio.Precision = 12;
            precio.Scale = 2;
            precio.Value = detalle.PrecioUnitario;

            await insertar.ExecuteNonQueryAsync();
        }

        await transaccion.CommitAsync();

        return StatusCode(201, new
        {
            id = facturaId,
            mensaje = "Factura registrada correctamente."
        });
    }
}

public class FacturaEntrada
{
    [Range(1, int.MaxValue)]
    public int ClienteId { get; set; }

    public DateTime Fecha { get; set; }

    public DateTime Vencimiento { get; set; }

    [StringLength(500)]
    public string? Observaciones { get; set; }

    [Required]
    public List<DetalleFacturaEntrada> Detalles { get; set; } = new();
}

public class DetalleFacturaEntrada
{
    [Required]
    [StringLength(200)]
    public string Descripcion { get; set; } = "";

    [Range(typeof(decimal), "0.01", "1000000")]
    public decimal Cantidad { get; set; }

    [Range(typeof(decimal), "0.01", "1000000")]
    public decimal PrecioUnitario { get; set; }
}
