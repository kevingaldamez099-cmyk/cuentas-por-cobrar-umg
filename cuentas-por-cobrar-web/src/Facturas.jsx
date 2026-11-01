import { useState } from 'react'
import { api } from './api'
import './Operaciones.css'

const hoy = () => {
  const fecha = new Date()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

const nuevoDetalle = () => ({
  descripcion: '',
  cantidad: '1',
  precioUnitario: '',
})

const dinero = (valor) =>
  `Q ${Number(valor).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export default function Facturas({ clientes, facturas, onActualizar }) {
  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [vencimiento, setVencimiento] = useState(hoy)
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState([nuevoDetalle()])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  function cambiarDetalle(indice, campo, valor) {
    setDetalles((anteriores) =>
      anteriores.map((detalle, posicion) =>
        posicion === indice
          ? { ...detalle, [campo]: valor }
          : detalle
      )
    )
  }

  const totalCentavos = detalles.reduce((suma, detalle) =>
    suma + Math.round(
      Number(detalle.cantidad || 0) *
      Number(detalle.precioUnitario || 0) * 100
    ), 0
  )

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setOcupado(true)

    try {
      await api('/facturas', {
        method: 'POST',
        body: JSON.stringify({
          clienteId: Number(clienteId),
          fecha,
          vencimiento,
          observaciones,
          detalles: detalles.map((detalle) => ({
            descripcion: detalle.descripcion,
            cantidad: Number(detalle.cantidad),
            precioUnitario: Number(detalle.precioUnitario),
          })),
        }),
      })

      setDetalles([nuevoDetalle()])
      setObservaciones('')
      await onActualizar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  async function anular(factura) {
    const motivo = window.prompt(
      `Vas a anular la factura F-${factura.id} de ${factura.cliente}.\n` +
      'Escribe el motivo o pulsa Cancelar:'
    )

    if (motivo === null) return

    if (!motivo.trim() || motivo.trim().length > 300) {
      setError('Escribe un motivo de entre 1 y 300 caracteres.')
      return
    }

    setError('')
    setOcupado(true)

    try {
      await api(`/facturas/${factura.id}/anular`, {
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
        <h2>Nueva factura</h2>
        <p className="texto-suave">
          Selecciona el cliente y agrega los conceptos de la venta.
        </p>

        <form onSubmit={guardar}>
          <fieldset disabled={ocupado}>
            <div className="campos-factura">
              <label>
                Cliente *
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.filter((c) => c.activo).map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre} — {cliente.nit}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Fecha de emisión *
                <input
                  type="date"
                  value={fecha}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </label>

              <label>
                Fecha de vencimiento *
                <input
                  type="date"
                  value={vencimiento}
                  min={fecha}
                  max="2100-12-31"
                  onChange={(e) => setVencimiento(e.target.value)}
                  required
                />
              </label>
            </div>

            {detalles.map((detalle, indice) => (
              <div className="linea-detalle" key={indice}>
                <label>
                  Concepto {indice + 1} *
                  <input
                    value={detalle.descripcion}
                    onChange={(e) =>
                      cambiarDetalle(indice, 'descripcion', e.target.value)
                    }
                    placeholder="Ej. Servicio de mantenimiento"
                    maxLength={200}
                    required
                  />
                </label>

                <label>
                  Cantidad *
                  <input
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={detalle.cantidad}
                    onChange={(e) =>
                      cambiarDetalle(indice, 'cantidad', e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Precio unitario (Q) *
                  <input
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={detalle.precioUnitario}
                    onChange={(e) =>
                      cambiarDetalle(indice, 'precioUnitario', e.target.value)
                    }
                    required
                  />
                </label>

                <button
                  type="button"
                  className="boton-secundario quitar-detalle"
                  disabled={detalles.length === 1}
                  aria-label={`Quitar concepto ${indice + 1}`}
                  onClick={() =>
                    setDetalles(detalles.filter((_, i) => i !== indice))
                  }
                >
                  Quitar
                </button>
              </div>
            ))}

            <button
              type="button"
              className="boton-secundario boton-corto"
              disabled={detalles.length >= 50}
              onClick={() => setDetalles([...detalles, nuevoDetalle()])}
            >
              + Agregar concepto
            </button>

            <label>
              Observaciones
              <input
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                maxLength={500}
                placeholder="Información adicional, opcional"
              />
            </label>

            <div className="pie-operacion">
              <div>
                <span>Total de la factura</span>
                <strong>{dinero(totalCentavos / 100)}</strong>
              </div>
              <button type="submit" className="boton-corto">
                {ocupado ? 'Guardando…' : 'Registrar factura'}
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      <section className="bloque">
        <h2>Facturas registradas</h2>
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th>Vencimiento</th>
                <th>Total</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((factura) => (
                <tr key={factura.id}>
                  <td>F-{factura.id}</td>
                  <td>{factura.cliente}</td>
                  <td>
                    {factura.vencimiento.slice(0, 10)
                      .split('-').reverse().join('/')}
                  </td>
                  <td>{dinero(factura.total)}</td>
                  <td>{dinero(factura.saldo)}</td>
                  <td>
                    <span className={
                      factura.anulada ? 'estado neutro' : factura.saldo === 0 ? 'estado pagada' : 'estado pendiente'
                    }>
                      {factura.anulada
                        ? 'Anulada'
                        : factura.saldo === 0 ? 'Pagada' : 'Pendiente'}
                    </span>
                  </td>
                  <td>
                    {!factura.anulada && (
                      <button
                        className="boton-tabla"
                        disabled={ocupado || factura.pagado > 0}
                        title={factura.pagado > 0
                          ? 'Primero anula los pagos vigentes'
                          : 'Anular esta factura'}
                        onClick={() => anular(factura)}
                      >
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {facturas.length === 0 && (
                <tr>
                  <td colSpan={7}>Todavía no hay facturas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
