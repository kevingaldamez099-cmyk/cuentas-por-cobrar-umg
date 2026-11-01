import { useEffect, useState } from 'react'
import { api } from './api'
import './Operaciones.css'

export default function Parametros() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const resultado = await api('/parametros')
        if (activo) setDatos(resultado)
      } catch (err) {
        if (activo) setError(err.message)
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [])

  function cambiar(evento) {
    setMensaje('')
    setDatos({
      ...datos,
      [evento.target.name]: evento.target.value,
    })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setMensaje('')
    setGuardando(true)

    try {
      const resultado = await api('/parametros', {
        method: 'PUT',
        body: JSON.stringify({
          nombreNegocio: datos.nombreNegocio,
          nit: datos.nit ?? '',
          telefono: datos.telefono,
          direccion: datos.direccion,
        }),
      })

      setMensaje(resultado.mensaje)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="bloque operaciones">
      <div>
        <h2>Información del negocio</h2>
        <p className="texto-suave">
          Estos datos aparecerán en los estados de cuenta que consultes
          e imprimas.
        </p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {cargando ? (
        <p role="status">Cargando configuración…</p>
      ) : datos ? (
        <form onSubmit={guardar}>
          <fieldset disabled={guardando}>
            <label>
              Nombre del negocio *
              <input
                name="nombreNegocio"
                value={datos.nombreNegocio}
                onChange={cambiar}
                maxLength={150}
                required
              />
            </label>

            <div className="campos-factura">
              <label>
                NIT de la empresa o local
                <input name="nit" value={datos.nit ?? ''} onChange={cambiar} maxLength={30} placeholder="Ej. 1234567-8" />
              </label>
              <label>
                Teléfono
                <input
                  name="telefono"
                  type="tel"
                  value={datos.telefono}
                  onChange={cambiar}
                  maxLength={30}
                />
              </label>

              <label>
                Moneda del sistema
                <input value="Quetzales (Q)" readOnly />
              </label>
            </div>

            <label>
              Dirección
              <input
                name="direccion"
                value={datos.direccion}
                onChange={cambiar}
                maxLength={250}
              />
            </label>

            {mensaje && (
              <p className="insignia" role="status">{mensaje}</p>
            )}

            <div>
              <button type="submit" className="boton-corto">
                {guardando ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <p>Comprueba la conexión y pulsa Actualizar datos para reintentar.</p>
      )}
    </section>
  )
}
