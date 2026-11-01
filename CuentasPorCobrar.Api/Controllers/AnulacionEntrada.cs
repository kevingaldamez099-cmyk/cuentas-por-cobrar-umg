using System.ComponentModel.DataAnnotations;

namespace CuentasPorCobrar.Api.Controllers;

public class AnulacionEntrada
{
    [Required(ErrorMessage = "Debes indicar el motivo.")]
    [StringLength(300)]
    public string Motivo { get; set; } = "";
}