using System.ComponentModel.DataAnnotations;
using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CuentasPorCobrar.Api.Controllers;

[ApiController]
[Route("api/clientes")]
public class ClientesController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ClientesController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    // Consulta los clientes registrados.
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        const string sql = """
            SELECT Id, Nombre, Nit, Telefono, Correo, Direccion, Activo
            FROM dbo.Clientes
            ORDER BY Id DESC;
            """;

        using var comando = new SqlCommand(sql, conexion);
        using var lector = await comando.ExecuteReaderAsync();

        var clientes = new List<object>();

        while (await lector.ReadAsync())
        {
            clientes.Add(new
            {
                id = lector.GetInt32(0),
                nombre = lector.GetString(1),
                nit = lector.GetString(2),
                telefono = lector.GetString(3),
                correo = lector.GetString(4),
                direccion = lector.GetString(5),
                activo = lector.GetBoolean(6)
            });
        }

        return Ok(clientes);
    }



    // Cambia el estado sin eliminar facturas ni pagos del cliente.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id, [FromBody] EliminarClienteEntrada datos)
    {
        if (datos.Confirmacion != $"ELIMINAR {id}")
            return BadRequest(new { mensaje = "La confirmación de eliminación no coincide." });

        using var conexion = new SqlConnection(_configuration.GetConnectionString("DefaultConnection"));
        await conexion.OpenAsync();
        using var transaccion = (SqlTransaction)await conexion.BeginTransactionAsync(IsolationLevel.Serializable);
        using var buscar = new SqlCommand("SELECT Id FROM dbo.Clientes WITH (UPDLOCK, HOLDLOCK) WHERE Id=@Id;", conexion, transaccion);
        buscar.Parameters.Add("@Id", SqlDbType.Int).Value = id;
        if (await buscar.ExecuteScalarAsync() is null)
            return NotFound(new { mensaje = "El cliente no existe." });

        // Orden de eliminación respetando las claves foráneas. Todo se confirma junto.
        using var borrar = new SqlCommand("""
            DELETE p FROM dbo.Pagos p JOIN dbo.Facturas f ON f.Id=p.FacturaId WHERE f.ClienteId=@Id;
            DELETE d FROM dbo.DetallesFactura d JOIN dbo.Facturas f ON f.Id=d.FacturaId WHERE f.ClienteId=@Id;
            DELETE FROM dbo.Facturas WHERE ClienteId=@Id;
            DELETE FROM dbo.Clientes WHERE Id=@Id;
            """, conexion, transaccion);
        borrar.Parameters.Add("@Id", SqlDbType.Int).Value = id;
        await borrar.ExecuteNonQueryAsync();
        await transaccion.CommitAsync();
        return Ok(new { mensaje = "Cliente, facturas y pagos eliminados definitivamente." });
    }

    [HttpPut("{id:int}/estado")]
    public async Task<IActionResult> CambiarEstado(int id, EstadoClienteEntrada datos)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));
        await conexion.OpenAsync();

        using var comando = new SqlCommand("""
            UPDATE dbo.Clientes SET Activo = @Activo WHERE Id = @Id;
            """, conexion);
        comando.Parameters.Add("@Id", SqlDbType.Int).Value = id;
        comando.Parameters.Add("@Activo", SqlDbType.Bit).Value = datos.Activo!.Value;

        if (await comando.ExecuteNonQueryAsync() == 0)
            return NotFound(new { mensaje = "El cliente no existe." });

        return Ok(new
        {
            mensaje = datos.Activo.Value ? "Cliente reactivado." : "Cliente desactivado.",
            activo = datos.Activo.Value
        });
    }

    // Modifica los datos de un cliente existente.
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Actualizar(int id, ClienteEntrada datos)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        const string sql = """
            UPDATE dbo.Clientes
            SET Nombre = @Nombre,
                Nit = @Nit,
                Telefono = @Telefono,
                Correo = @Correo,
                Direccion = @Direccion
            WHERE Id = @Id;
            """;

        using var comando = new SqlCommand(sql, conexion);

        comando.Parameters.Add("@Id", SqlDbType.Int).Value = id;

        comando.Parameters.Add("@Nombre", SqlDbType.NVarChar, 150)
            .Value = datos.Nombre.Trim();

        comando.Parameters.Add("@Nit", SqlDbType.NVarChar, 30)
            .Value = datos.Nit.Trim();

        comando.Parameters.Add("@Telefono", SqlDbType.NVarChar, 30)
            .Value = datos.Telefono?.Trim() ?? "";

        comando.Parameters.Add("@Correo", SqlDbType.NVarChar, 150)
            .Value = datos.Correo?.Trim() ?? "";

        comando.Parameters.Add("@Direccion", SqlDbType.NVarChar, 250)
            .Value = datos.Direccion?.Trim() ?? "";

        var filas = await comando.ExecuteNonQueryAsync();

        if (filas == 0)
        {
            return NotFound(new { mensaje = "El cliente no existe." });
        }

        return Ok(new { mensaje = "Cliente actualizado correctamente." });
    }


















    // Registra un cliente nuevo.
    [HttpPost]
    public async Task<IActionResult> Crear(ClienteEntrada datos)
    {
        using var conexion = new SqlConnection(
            _configuration.GetConnectionString("DefaultConnection"));

        await conexion.OpenAsync();

        const string sql = """
            INSERT INTO dbo.Clientes
                (Nombre, Nit, Telefono, Correo, Direccion)
            OUTPUT INSERTED.Id
            VALUES
                (@Nombre, @Nit, @Telefono, @Correo, @Direccion);
            """;

        using var comando = new SqlCommand(sql, conexion);

        comando.Parameters.Add("@Nombre", SqlDbType.NVarChar, 150)
            .Value = datos.Nombre.Trim();

        comando.Parameters.Add("@Nit", SqlDbType.NVarChar, 30)
            .Value = datos.Nit.Trim();

        comando.Parameters.Add("@Telefono", SqlDbType.NVarChar, 30)
            .Value = datos.Telefono?.Trim() ?? "";

        comando.Parameters.Add("@Correo", SqlDbType.NVarChar, 150)
            .Value = datos.Correo?.Trim() ?? "";

        comando.Parameters.Add("@Direccion", SqlDbType.NVarChar, 250)
            .Value = datos.Direccion?.Trim() ?? "";

        var id = (int)(await comando.ExecuteScalarAsync())!;

        return StatusCode(201, new
        {
            id,
            mensaje = "Cliente registrado correctamente."
        });
    }
}

// Define los datos aceptados y sus validaciones.
public class ClienteEntrada
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [StringLength(150)]
    public string Nombre { get; set; } = "";

    [Required(ErrorMessage = "El NIT es obligatorio. Usa CF si no tiene.")]
    [StringLength(30)]
    public string Nit { get; set; } = "CF";

    [StringLength(30)]
    public string? Telefono { get; set; }

    [StringLength(150)]
    [EmailAddress(ErrorMessage = "El correo no es válido.")]
    public string? Correo { get; set; }

    [StringLength(250)]
    public string? Direccion { get; set; }
}

public class EstadoClienteEntrada
{
    [Required(ErrorMessage = "Debes indicar si el cliente está activo.")]
    public bool? Activo { get; set; }
}

public class EliminarClienteEntrada
{
    [Required]
    [StringLength(40)]
    public string Confirmacion { get; set; } = "";
}
