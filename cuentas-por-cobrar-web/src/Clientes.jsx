import { useState } from 'react'
import { api } from './api'


const nuevoCliente = {
  nombre: '',
  nit: 'CF',
  telefono: '',
  correo: '',
  direccion: '',
}

export default function Clientes({ clientes, onActualizar }) {
  const [formulario, setFormulario] = useState({ ...nuevoCliente })
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('activos')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function cambiar(evento) {
    setFormulario({
      ...formulario,
      [evento.target.name]: evento.target.value,
    })
  }

  function editar(cliente) {
    setEditando(cliente.id)
    setError('')
    setFormulario({
      nombre: cliente.nombre,
      nit: cliente.nit,
      telefono: cliente.telefono,
      correo: cliente.correo,
      direccion: cliente.direccion,
    })
  }

  function limpiar() {
    setEditando(null)
    setFormulario({ ...nuevoCliente })
    setError('')
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError('')

    try {
      await api(
        editando ? `/clientes/${editando}` : '/clientes',
        {
          method: editando ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...formulario,
            correo: formulario.correo.trim() || null,
          }),
        }
      )

      limpiar()
      await onActualizar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(cliente) {
    const accion = cliente.activo ? 'desactivar' : 'reactivar'
    const aviso = cliente.activo
      ? 'Su información, facturas y pagos se ocultarán del resumen, las operaciones, los estados de cuenta, el historial y los PDF. Los datos y las deudas se conservarán y volverán a estar disponibles al reactivarlo.'
      : 'Su información volverá a estar disponible en los demás apartados. Las facturas archivadas seguirán en el historial archivado. Podrá recibir nuevas facturas.'
    if (!window.confirm(`¿Quieres ${accion} a ${cliente.nombre}?\n\n${aviso}`)) return
    setGuardando(true)
    setError('')
    try {
      await api(`/clientes/${cliente.id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activo: !cliente.activo }),
      })
      if (editando === cliente.id) limpiar()
      await onActualizar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(cliente) {
    const texto = `ELIMINAR ${cliente.id}`
    const confirmacion = window.prompt(
      `Eliminar definitivamente a ${cliente.nombre}.\n\nSe borrarán sus datos, TODAS sus facturas, detalles y pagos, incluidos los archivados. También se eliminarán sus saldos pendientes. No se puede deshacer desde la aplicación.\n\nPara confirmar escribe exactamente: ${texto}`
    )
    if (confirmacion === null) return
    if (confirmacion !== texto) {
      setError('No se eliminó el cliente: la confirmación no coincide.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await api(`/clientes/${cliente.id}`, { method: 'DELETE', body: JSON.stringify({ confirmacion }) })
      if (editando === cliente.id) limpiar()
      await onActualizar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const filtrados = clientes.filter((cliente) =>
    (estado === 'todos' || (estado === 'activos' ? cliente.activo : !cliente.activo)) &&
    `${cliente.nombre} ${cliente.nit} ${cliente.telefono}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  )

  return (
    <div className="rejilla-clientes">
      <section className="bloque">
        <h2>{editando ? 'Editar cliente' : 'Nuevo cliente'}</h2>

        <form onSubmit={guardar}>
          <fieldset disabled={guardando}>
            <label htmlFor="nombreCliente">Nombre completo</label>
            <input
              id="nombreCliente"
              name="nombre"
              value={formulario.nombre}
              onChange={cambiar}
              maxLength={150}
              required
            />

            <label htmlFor="nitCliente">NIT</label>
            <input
              id="nitCliente"
              name="nit"
              value={formulario.nit}
              onChange={cambiar}
              maxLength={30}
              required
            />

            <label htmlFor="telefonoCliente">Teléfono</label>
            <input
              id="telefonoCliente"
              name="telefono"
              type="tel"
              value={formulario.telefono}
              onChange={cambiar}
              maxLength={30}
            />

            <label htmlFor="correoCliente">Correo electrónico</label>
            <input
              id="correoCliente"
              name="correo"
              type="email"
              value={formulario.correo}
              onChange={cambiar}
              maxLength={150}
            />

            <label htmlFor="direccionCliente">Dirección</label>
            <input
              id="direccionCliente"
              name="direccion"
              value={formulario.direccion}
              onChange={cambiar}
              maxLength={250}
            />

            {error && <p className="error" role="alert">{error}</p>}

            <button type="submit">
              {guardando
                ? 'Guardando…'
                : editando ? 'Guardar cambios' : 'Registrar cliente'}
            </button>

            {editando && (
              <button
                className="boton-secundario"
                type="button"
                onClick={limpiar}
              >
                Cancelar edición
              </button>
            )}
          </fieldset>
        </form>
      </section>

      <section className="bloque">
        <h2>Directorio de clientes</h2>

        <label htmlFor="estadoCliente">Mostrar clientes</label>
        <select
          id="estadoCliente"
          className="filtro-clientes"
          value={estado}
          onChange={(evento) => setEstado(evento.target.value)}
        >
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>

        <label htmlFor="buscarCliente">Buscar por nombre, NIT o teléfono</label>
        <input
          id="buscarCliente"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Escribe para buscar…"
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>NIT</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>
                    <strong>{cliente.nombre}</strong>
                    <small className="correo-cliente">{cliente.correo}</small>
                  </td>
                  <td>{cliente.nit}</td>
                  <td>{cliente.telefono || '—'}</td>
                  <td><span className={cliente.activo ? 'estado' : 'estado neutro'}>
                    {cliente.activo ? 'Activo' : 'Inactivo'}
                  </span></td>
                  <td>
                    <div className="acciones-cliente">
                    <button
                      className="boton-tabla"
                      onClick={() => editar(cliente)}
                      disabled={guardando}
                    >
                      Editar
                    </button>
                    <button
                      className="boton-tabla"
                      onClick={() => cambiarEstado(cliente)}
                      disabled={guardando}
                    >
                      {cliente.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                    <button className="boton-tabla boton-peligro" onClick={() => eliminar(cliente)} disabled={guardando}>
                      Eliminar
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5}>No hay clientes que coincidan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
