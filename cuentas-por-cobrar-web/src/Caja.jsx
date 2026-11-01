import { useEffect, useState } from 'react'
import { api } from './api'
import './Operaciones.css'

const dinero = (valor) =>
  `Q ${Number(valor).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function hoy() {
  const fecha = new Date()
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function Caja({ facturas, onActualizar }) {
  const [pagos, setPagos] = useState([])
  const [facturaId, setFacturaId] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('Efectivo')
  const [referencia, setReferencia] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarPagos() {
      try {
        const datos = await api('/pagos')
        if (activo) setPagos(datos)
      } catch (err) {
        if (activo) setError(err.message)
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargarPagos()
    return () => { activo = false }
  }, [])

  const pendientes = facturas.filter(
    (factura) => !factura.anulada && factura.saldo > 0
  )

  const seleccionada = pendientes.find(
    (factura) => factura.id === Number(facturaId)
  )

  async function registrar(evento) {
    evento.preventDefault()
    setError('')

    if (!seleccionada) {
      setError('Selecciona una factura con saldo pendiente.')
      return
    }

    setOcupado(true)

    try {
      await api('/pagos', {
        method: 'POST',
        body: JSON.stringify({
          facturaId: Number(facturaId),
          fecha,
          monto: Number(monto),
          metodo,
          referencia: metodo === 'Deposito' ? referencia : '',
        }),
      })

      setMonto('')
      setReferencia('')
      await onActualizar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  async function anular(pago) {
    const motivo = window.prompt(
      `Vas a anular el recibo R-${pago.id} por ${dinero(pago.monto)}.\n` +
      'El importe volverá al saldo pendiente. Escribe el motivo:'
    )

    if (motivo === null) return

    if (!motivo.trim() || motivo.trim().length > 300) {
      setError('El motivo debe tener entre 1 y 300 caracteres.')
      return
    }

    setError('')
    setOcupado(true)

    try {
      await api(`/pagos/${pago.id}/anular`, {
        method: 'POST',
        body: JSON.stringify({ motivo: motivo.trim() }),
      })

      await onActualizar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="operaciones">
      {error && <p className="error" role="alert">{error}</p>}

      <section className="bloque">
        <h2>Registrar un pago</h2>
        <p className="texto-suave">
          Selecciona la factura y registra el importe recibido.
        </p>

        {pendientes.length === 0 ? (
          <p>No hay facturas pendientes de cobro.</p>
        ) : (
          <form onSubmit={registrar}>
            <fieldset disabled={ocupado || cargando}>
              <label>
                Factura pendiente *
                <select
                  value={facturaId}
                  onChange={(e) => {
                    setFacturaId(e.target.value)
                    setMonto('')
                  }}
                  required
                >
                  <option value="">Selecciona una factura</option>
                  {pendientes.map((factura) => (
                    <option key={factura.id} value={factura.id}>
                      F-{factura.id} · {factura.cliente}
                      {' · Saldo: '}{dinero(factura.saldo)}
                    </option>
                  ))}
                </select>
              </label>

              {seleccionada && (
                <p className="insignia">
                  Saldo pendiente: {dinero(seleccionada.saldo)}
                </p>
              )}

              <div className="campos-factura">
                <label>
                  Importe recibido (Q) *
                  <input
                    type="number"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    min="0.01"
                    max={seleccionada?.saldo ?? 1000000000000}
                    step="0.01"
                    placeholder="Ej. 40.00"
                    required
                  />
                </label>

                <label>
                  Fecha del pago *
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    min={seleccionada?.fecha.slice(0, 10) ?? '2000-01-01'}
                    max="2100-12-31"
                    required
                  />
                </label>

                <label>
                  Método de pago *
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Deposito">Depósito bancario</option>
                  </select>
                </label>
              </div>

              {metodo === 'Deposito' && (
                <label>
                  Número de referencia del depósito *
                  <input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    maxLength={100}
                    placeholder="Número de boleta o comprobante"
                    required
                  />
                </label>
              )}

              <button
                type="submit"
                className="boton-corto"
                disabled={!seleccionada}
              >
                {ocupado ? 'Registrando…' : 'Registrar pago'}
              </button>
            </fieldset>
          </form>
        )}
      </section>

      <section className="bloque">
        <h2>Historial de recibos</h2>
        <p className="texto-suave">
          Los recibos anulados se conservan, pero no reducen la deuda.
          Consulta los recibos archivados y guarda una copia en PDF desde Historial.
        </p>

        {cargando ? (
          <p role="status">Cargando recibos…</p>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Recibo</th>
                  <th>Factura / cliente</th>
                  <th>Fecha</th>
                  <th>Importe</th>
                  <th>Método</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagos.filter((pago) => !pago.archivado).map((pago) => (
                  <tr key={pago.id}>
                    <td>R-{pago.id}</td>
                    <td>
                      F-{pago.facturaId}
                      <small className="correo-cliente">{pago.cliente}</small>
                    </td>
                    <td>
                      {pago.fecha.slice(0, 10)
                        .split('-').reverse().join('/')}
                    </td>
                    <td>{dinero(pago.monto)}</td>
                    <td>
                      {pago.metodo === 'Deposito' ? 'Depósito' : 'Efectivo'}
                      {pago.referencia && (
                        <small className="correo-cliente">
                          Ref.: {pago.referencia}
                        </small>
                      )}
                    </td>
                    <td>
                      <span className={
                        pago.anulado ? 'estado neutro' : 'estado'
                      }>
                        {pago.anulado ? 'Anulado' : 'Vigente'}
                      </span>
                    </td>
                    <td>
                      {!pago.anulado && (
                        <button
                          className="boton-tabla"
                          onClick={() => anular(pago)}
                          disabled={ocupado}
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {pagos.filter((pago) => !pago.archivado).length === 0 && !error && (
                  <tr>
                    <td colSpan={7}>No hay recibos sin archivar. Puedes consultar los anteriores en Historial.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
