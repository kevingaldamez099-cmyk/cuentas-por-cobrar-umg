import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import Clientes from './Clientes'
import Facturas from './Facturas'
import Caja from './Caja'
import EstadosCuenta from './EstadosCuenta'
import Parametros from './Parametros'
import './Mejoras.css'
import Historial from './Historial'

const simbolos = {
  Resumen: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  Clientes: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  Facturas: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h6',
  'Caja y pagos': 'M3 5h18v14H3z M3 9h18 M7 15h4',
  'Estados de cuenta': 'M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5',
  'Parámetros': 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  Historial: 'M3 4h18v5H3z M5 9v12h14V9 M10 13h4',
}

function Icono({ nombre }) {
  return <svg className="icono-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={simbolos[nombre]} /></svg>
}

const dinero = (valor) =>
  `Q ${Number(valor).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export default function Panel({ usuario, onSalir, saliendo, errorSalida }) {
  const [seccion, setSeccion] = useState('Resumen')
  const [clientes, setClientes] = useState([])
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')

    try {
      const [listaClientes, listaFacturas] = await Promise.all([
        api('/clientes'),
        api('/facturas'),
      ])

      setClientes(listaClientes)
      setFacturas(listaFacturas)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const vigentes = facturas.filter((factura) => !factura.anulada)
  const clientesActivos = clientes.filter((cliente) => cliente.activo)
  const idsActivos = new Set(clientesActivos.map((cliente) => cliente.id))
  const facturasResumen = facturas.filter((factura) => !factura.archivada && idsActivos.has(factura.clienteId))
  const saldo = vigentes.reduce((suma, factura) => suma + factura.saldo, 0)
  const cobrado = vigentes
    .filter((factura) => idsActivos.has(factura.clienteId))
    .reduce((suma, factura) => suma + factura.pagado, 0)
  const pendientes = vigentes.filter((factura) => factura.saldo > 0).length

  return (
    <div className="sistema">
      <aside className="lateral">
        <div className="marca">
          <span className="logo">CC</span>
          <span>Cuentas<br />por cobrar</span>
        </div>

        <p className="menu-titulo">ADMINISTRACIÓN</p>

        <nav aria-label="Menú principal">
          {['Resumen', 'Clientes', 'Facturas', 'Caja y pagos', 'Estados de cuenta', 'Historial', 'Parámetros'].map((nombre) => (
            <button
              key={nombre}
              className={seccion === nombre ? 'nav-activo' : ''}
              aria-current={seccion === nombre ? 'page' : undefined}
              onClick={() => setSeccion(nombre)}
            >
              <Icono nombre={nombre} />
              <span>{nombre}</span>
            </button>
          ))}
        </nav>

        <div className="usuario-panel">
          <small>SESIÓN ACTIVA</small>
          <strong>{usuario.nombre}</strong>
          <button onClick={onSalir} disabled={saliendo}>
            {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <main className="contenido">
        <header className="encabezado">
          <div>
            <p className="etiqueta verde">GESTIÓN DEL NEGOCIO</p>
            <h1>{seccion}</h1>
            <p className="texto-suave">
{{
  Resumen: 'Una vista general de tus cuentas por cobrar.',
  Clientes: 'Registra y mantén actualizados los datos de tus clientes.',
  Facturas: 'Registra ventas a crédito y consulta sus saldos.',
  'Caja y pagos': 'Registra cobros y consulta el historial de recibos.',
  'Estados de cuenta': 'Consulta e imprime los movimientos de cada cliente.',
  'Parámetros': 'Configura los datos generales de tu negocio.',
  Historial: 'Consulta, guarda en PDF y organiza tus facturas y pagos.',
}[seccion]}
            </p>
          </div>

          <button
            className="boton-secundario"
            onClick={cargar}
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : 'Actualizar datos'}
          </button>
        </header>

        {errorSalida && (
          <p className="error" role="alert">{errorSalida}</p>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        {cargando ? (
          <p role="status">Cargando información…</p>
        ) : error ? (
          <p>Comprueba que la API esté encendida y pulsa Actualizar datos.</p>
        ) : seccion === 'Resumen' ? (
          <>
            <section className="accesos-rapidos" aria-label="Accesos rápidos">
              <div><strong>Tu negocio, al día</strong><span>Elige una tarea para comenzar.</span></div>
              <div className="acciones-rapidas">
                <button onClick={() => setSeccion('Clientes')}><Icono nombre="Clientes" /> Nuevo cliente</button>
                <button onClick={() => setSeccion('Facturas')}><Icono nombre="Facturas" /> Crear factura</button>
                <button onClick={() => setSeccion('Caja y pagos')}><Icono nombre="Caja y pagos" /> Registrar pago</button>
              </div>
            </section>
            <section className="indicadores">
              <article className="indicador destacado">
                <span>Saldo por cobrar</span>
                <strong>{dinero(saldo)}</strong>
                <small>Facturas vigentes</small>
              </article>

              <article className="indicador">
                <span>Pagos vigentes</span>
                <strong>{dinero(cobrado)}</strong>
                <small>De clientes activos</small>
              </article>

              <article className="indicador">
                <span>Clientes activos</span>
                <strong>{clientesActivos.length}</strong>
                <small>Disponibles para nuevas facturas</small>
              </article>

              <article className="indicador">
                <span>Facturas pendientes</span>
                <strong>{pendientes}</strong>
                <small>Con saldo mayor a cero</small>
              </article>
            </section>

            <section className="bloque">
              <h2>Últimas facturas de clientes activos</h2>
              <p className="texto-suave nota-resumen">
                Todos los indicadores corresponden únicamente a clientes activos.
                Al desactivar un cliente, sus movimientos se ocultan sin borrarse.
                Archivar oculta registros de las listas habituales, pero no cambia
                los saldos de los clientes activos.
              </p>

              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasResumen.slice(0, 5).map((factura) => (
                      <tr key={factura.id}>
                        <td>F-{factura.id}</td>
                        <td>{factura.cliente}</td>
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
                      </tr>
                    ))}
                    {facturasResumen.length === 0 && (
                      <tr>
                        <td colSpan={5}>No hay facturas de clientes activos.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : seccion === 'Clientes' ? (
          <Clientes clientes={clientes} onActualizar={cargar} />
        ) : seccion === 'Facturas' ? (
          <Facturas
            clientes={clientesActivos}
            facturas={facturas.filter((factura) => !factura.archivada)}
            onActualizar={cargar}
          />
        ) : seccion === 'Caja y pagos' ? (
          <Caja facturas={facturas} onActualizar={cargar} />
        ) : seccion === 'Historial' ? (
          <Historial onActualizar={cargar} />
        ) : seccion === 'Estados de cuenta' ? (
          <EstadosCuenta clientes={clientesActivos} />
        ) : (
          <Parametros />
        )}
      </main>
    </div>
  )
}
