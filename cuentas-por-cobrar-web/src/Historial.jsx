import { useEffect, useState } from 'react'
import { api } from './api'
import './EstadosCuenta.css'
import './Historial.css'

const dinero = (valor) => `Q ${Number(valor).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fecha = (valor) => valor.slice(0, 10).split('-').reverse().join('/')
const estadoFactura = (f) => f.anulada ? 'Anulada' : f.saldo === 0 ? 'Pagada' : 'Pendiente'

export default function Historial({ onActualizar }) {
  const [datos, setDatos] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([api('/facturas'), api('/pagos'), api('/parametros')])
      .then(([facturas, pagos, negocio]) => {
        if (activo) setDatos({ facturas, pagos, negocio, consultado: new Date().toLocaleString('es-GT') })
      })
      .catch((err) => { if (activo) setError(err.message) })
    return () => { activo = false }
  }, [])

  async function cambiarArchivo(archivar) {
    const texto = archivar
      ? 'Se archivarán TODAS las facturas de clientes activos y sus pagos, no solo las del filtro. Se ocultarán de las listas habituales. Las deudas, totales y estados de cuenta no cambian. Podrás restaurarlos desde aquí. ¿Continuar?'
      : 'Se restaurarán TODAS las facturas archivadas de clientes activos y sus pagos a las listas habituales. ¿Continuar?'
    if (!window.confirm(texto)) return
    setOcupado(true)
    setError('')
    try {
      await api('/historial/archivo', { method: 'PUT', body: JSON.stringify({ archivar }) })
      await onActualizar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const incluir = (archivado) => filtro === 'todos' || (filtro === 'archivados' ? archivado : !archivado)
  const facturas = datos?.facturas.filter((f) => incluir(f.archivada)) ?? []
  const pagos = datos?.pagos.filter((p) => incluir(p.archivado)) ?? []
  const etiquetas = { todos: 'Todos los registros', archivados: 'Solo archivados', actuales: 'Sin archivar' }

  return <div className="operaciones historial-completo">
    <section className="bloque no-imprimir">
      <h2>Conserva una copia de tus movimientos</h2>
      <p className="texto-suave">Solo se muestran movimientos de clientes activos. El PDF incluye las facturas y los pagos del filtro seleccionado, con clientes, importes y estados. Al abrir la impresión, elige «Guardar como PDF». Es una copia de consulta, no un respaldo restaurable de la base de datos.</p>
      <label htmlFor="filtroHistorial">Registros que deseas consultar y exportar</label>
      <select id="filtroHistorial" className="filtro-clientes" value={filtro} onChange={(e) => setFiltro(e.target.value)} disabled={ocupado}>
        {Object.entries(etiquetas).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
      </select>
      <div className="herramientas-historial">
        <button className="boton-corto" disabled={!datos || ocupado || !!error} onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <button className="boton-secundario boton-corto" disabled={!datos || ocupado || !datos.facturas.some((f) => !f.archivada)} onClick={() => cambiarArchivo(true)}>Archivar todo el historial</button>
        <button className="boton-secundario boton-corto" disabled={!datos || ocupado || !datos.facturas.some((f) => f.archivada)} onClick={() => cambiarArchivo(false)}>Restaurar todo el historial</button>
      </div>
      <p className="nota-reporte">Archivar conserva los datos. Las nuevas facturas aparecerán normalmente. Los saldos pendientes seguirán disponibles en Caja y pagos; los estados de cuenta siempre incluyen el historial completo.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {ocupado && <p role="status">Actualizando el archivo…</p>}
    </section>
    {!datos && !error && <p role="status">Cargando historial…</p>}
    {datos && <section className="bloque reporte-cuenta">
      <p className="etiqueta verde">{datos.negocio.nombreNegocio}</p>
      <h2>Historial de facturas y pagos</h2>
      {datos.negocio.nit && <p>NIT del negocio: {datos.negocio.nit}</p>}
      <p>{datos.negocio.direccion}{datos.negocio.telefono ? ` · Tel.: ${datos.negocio.telefono}` : ''}</p>
      <p className="texto-suave">Clientes activos · {etiquetas[filtro]} · Consulta: {datos.consultado}</p>
      <div className="totales-reporte">
        <div><span>Facturas incluidas</span><strong>{facturas.length}</strong></div>
        <div><span>Recibos incluidos</span><strong>{pagos.length}</strong></div>
        <div className="saldo-reporte"><span>Saldo de facturas incluidas</span><strong>{dinero(facturas.reduce((suma, f) => suma + f.saldo, 0))}</strong></div>
      </div>
      <h3>Facturas</h3>
      <div className="tabla-contenedor"><table>
        <thead><tr>{['Factura', 'Cliente', 'Emisión', 'Vencimiento', 'Total', 'Pagado', 'Saldo', 'Estado', 'Archivo'].map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{facturas.map((f) => <tr key={f.id}>
          <td>F-{f.id}</td><td>{f.cliente}</td><td>{fecha(f.fecha)}</td><td>{fecha(f.vencimiento)}</td><td>{dinero(f.total)}</td><td>{dinero(f.pagado)}</td><td>{dinero(f.saldo)}</td><td>{estadoFactura(f)}</td><td>{f.archivada ? 'Archivada' : 'Sin archivar'}</td>
        </tr>)}{!facturas.length && <tr><td colSpan={9}>No hay facturas en este filtro.</td></tr>}</tbody>
      </table></div>
      <h3>Pagos y recibos</h3>
      <div className="tabla-contenedor"><table>
        <thead><tr>{['Recibo', 'Factura', 'Cliente', 'Fecha', 'Importe', 'Método / referencia', 'Estado', 'Archivo'].map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{pagos.map((p) => <tr key={p.id}>
          <td>R-{p.id}</td><td>F-{p.facturaId}</td><td>{p.cliente}</td><td>{fecha(p.fecha)}</td><td>{dinero(p.monto)}</td><td>{p.metodo === 'Deposito' ? 'Depósito' : 'Efectivo'}<small className="correo-cliente">{p.referencia}</small></td><td>{p.anulado ? 'Anulado' : 'Vigente'}</td><td>{p.archivado ? 'Archivado' : 'Sin archivar'}</td>
        </tr>)}{!pagos.length && <tr><td colSpan={8}>No hay pagos en este filtro.</td></tr>}</tbody>
      </table></div>
      <p className="nota-reporte">Archivar no anula operaciones ni modifica importes. Los recibos anulados se conservan como evidencia y no reducen el saldo. Este documento refleja los datos al momento de la consulta.</p>
    </section>}
  </div>
}
