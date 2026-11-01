import { useState } from 'react'
import { api } from './api'
import './Operaciones.css'
import './EstadosCuenta.css'

const dinero = (valor) =>
  `Q ${Number(valor).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fechaCorta = (valor) =>
  valor.slice(0, 10).split('-').reverse().join('/')

export default function EstadosCuenta({ clientes }) {
  const [clienteId, setClienteId] = useState('')
  const [reporte, setReporte] = useState(null)
  const [negocio, setNegocio] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [consultadoEn, setConsultadoEn] = useState('')

  async function consultar(evento) {
    evento.preventDefault()
    setError('')
    setReporte(null)
    setCargando(true)

    try {
      const [estado, parametros] = await Promise.all([
        api(`/estados-cuenta/${clienteId}`),
        api('/parametros'),
      ])

      setReporte(estado)
      setNegocio(parametros)
      setConsultadoEn(new Date().toLocaleString('es-GT'))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="operaciones">
      <section className="bloque no-imprimir">
        <h2>Consultar estado de cuenta</h2>
        <p className="texto-suave">
          Selecciona un cliente para ver sus facturas, pagos y saldo pendiente.
        </p>

        <form onSubmit={consultar}>
          <fieldset disabled={cargando}>
            <label>
              Cliente *
              <select
                value={clienteId}
                onChange={(evento) => {
                  setClienteId(evento.target.value)
                  setReporte(null)
                  setError('')
                }}
                required
              >
                <option value="">Selecciona un cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre} — {cliente.nit}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="boton-corto"
              disabled={!clienteId}
            >
              {cargando ? 'Consultando…' : 'Consultar estado de cuenta'}
            </button>
          </fieldset>
        </form>

        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {reporte && (
        <section className="bloque reporte-cuenta">
          <div className="cabecera-reporte">
            <div>
              <p className="etiqueta verde">{negocio?.nombreNegocio}</p>
              <h2>Estado de cuenta</h2>
              {negocio?.nit && <p>NIT del negocio: {negocio.nit}</p>}
              {negocio?.direccion && <p>{negocio.direccion}</p>}
              {negocio?.telefono && <p>Tel.: {negocio.telefono}</p>}
              <p className="texto-suave">
                Consulta realizada: {consultadoEn}
              </p>
            </div>

            <button
              type="button"
              className="boton-secundario boton-corto no-imprimir"
              onClick={() => window.print()}
            >
              Imprimir / Guardar PDF
            </button>
          </div>

          <div className="datos-cliente-reporte">
            <strong>{reporte.cliente.nombre}</strong>
            <span>NIT: {reporte.cliente.nit}</span>
            <span>Teléfono: {reporte.cliente.telefono || 'No registrado'}</span>
            {reporte.cliente.correo && (
              <span>{reporte.cliente.correo}</span>
            )}
          </div>

          <div className="totales-reporte">
            <div>
              <span>Facturación vigente</span>
              <strong>
                {dinero(reporte.resumen.totalFacturadoVigente)}
              </strong>
            </div>
            <div>
              <span>Pagos vigentes</span>
              <strong>
                {dinero(reporte.resumen.totalPagadoVigente)}
              </strong>
            </div>
            <div className="saldo-reporte">
              <span>Saldo pendiente</span>
              <strong>{dinero(reporte.resumen.saldoPendiente)}</strong>
            </div>
          </div>

          <h3>Facturas del cliente</h3>

          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reporte.facturas.map((factura) => (
                  <tr key={factura.id}>
                    <td>F-{factura.id}</td>
                    <td>{fechaCorta(factura.fecha)}</td>
                    <td>{fechaCorta(factura.vencimiento)}</td>
                    <td>{dinero(factura.total)}</td>
                    <td>{dinero(factura.pagado)}</td>
                    <td>{dinero(factura.saldo)}</td>
                    <td>
                      {factura.anulada
                        ? 'Anulada'
                        : factura.saldo === 0 ? 'Pagada' : 'Pendiente'}
                    </td>
                  </tr>
                ))}
                {reporte.facturas.length === 0 && (
                  <tr>
                    <td colSpan={7}>No hay facturas registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3>Historial de pagos</h3>

          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Recibo</th>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Método / referencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reporte.pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td>R-{pago.id}</td>
                    <td>F-{pago.facturaId}</td>
                    <td>{fechaCorta(pago.fecha)}</td>
                    <td>{dinero(pago.monto)}</td>
                    <td>
                      {pago.metodo === 'Deposito' ? 'Depósito' : 'Efectivo'}
                      {pago.referencia && (
                        <small className="correo-cliente">
                          {pago.referencia}
                        </small>
                      )}
                    </td>
                    <td>
                      {pago.anulado ? 'Anulado' : 'Vigente'}
                      {pago.anulado && pago.motivoAnulacion && (
                        <small className="correo-cliente">
                          {pago.motivoAnulacion}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
                {reporte.pagos.length === 0 && (
                  <tr>
                    <td colSpan={6}>No hay pagos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="nota-reporte">
            Las operaciones anuladas se muestran como historial y no
            se incluyen en los totales vigentes. Este reporte muestra
            los movimientos registrados hasta el momento de la consulta.
          </p>
        </section>
      )}
    </div>
  )
}
