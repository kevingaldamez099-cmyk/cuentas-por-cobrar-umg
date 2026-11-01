import { useEffect, useState } from 'react'
import { api } from './api'
import Panel from './Panel'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function comprobarSesion() {
      try {
        const datos = await api('/auth/yo')
        if (activo) setUsuario(datos)
      } catch (err) {
        if (activo && err.status !== 401) {
          setError(err.message)
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    comprobarSesion()
    return () => { activo = false }
  }, [])

  async function ingresar(evento) {
    evento.preventDefault()
    setError('')
    setOcupado(true)

    const formulario = evento.currentTarget
    const campos = new FormData(formulario)

    try {
      const datos = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          usuario: campos.get('usuario'),
          clave: campos.get('clave'),
        }),
      })

      formulario.reset()
      setUsuario(datos)
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  async function salir() {
    setError('')
    setOcupado(true)

    try {
      await api('/auth/logout', { method: 'POST' })
      setUsuario(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  if (cargando) {
    return <main className="cargando">Comprobando sesión…</main>
  }


  if (usuario) {
  return (
    <Panel
      usuario={usuario}
      onSalir={salir}
      saliendo={ocupado}
      errorSalida={error}
    />
  )
}

  return (
    <main className="acceso">
      <section className="presentacion">
        <div className="marca">
          <span className="logo">CC</span>
          <span>Cuentas por cobrar</span>
        </div>

        <div>
          <p className="etiqueta">CONTROL PARA TU NEGOCIO</p>
          <h1>Tus cuentas claras.<br />Tu negocio en orden.</h1>
          <p className="descripcion">
            Organiza clientes, registra facturas y lleva el control
            de cada pago desde un solo lugar.
          </p>
          <div className="caracteristicas">
            <span>Clientes</span>
            <span>Facturas</span>
            <span>Cobros</span>
          </div>
        </div>

        <p className="pie">Gestión sencilla · Información organizada</p>
      </section>

      <section className="zona-formulario">
        <div className="tarjeta">
          {usuario ? (
            <>
              <span className="insignia">Sesión iniciada</span>
              <h2>Bienvenido, {usuario.nombre}</h2>
              <p className="texto-suave">
                Tu acceso al sistema se verificó correctamente.
              </p>

              {error && <p className="error" role="alert">{error}</p>}

              <button
                type="button"
                onClick={salir}
                disabled={ocupado}
              >
                {ocupado ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </>
          ) : (
            <>
              <p className="etiqueta verde">BIENVENIDO</p>
              <h2>Ingresa a tu cuenta</h2>
              <p className="texto-suave">
                Utiliza tus credenciales para acceder al sistema.
              </p>

              <form onSubmit={ingresar}>
                <label htmlFor="usuario">Usuario</label>
                <input
                  id="usuario"
                  name="usuario"
                  autoComplete="username"
                  placeholder="Escribe tu usuario"
                  maxLength={50}
                  required
                />

                <label htmlFor="clave">Contraseña</label>
                <input
                  id="clave"
                  name="clave"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Escribe tu contraseña"
                  maxLength={200}
                  required
                />

                {error && <p className="error" role="alert">{error}</p>}

                <button type="submit" disabled={ocupado}>
                  {ocupado ? 'Verificando…' : 'Ingresar al sistema →'}
                </button>
              </form>

              <p className="nota">
                Acceso exclusivo para usuarios autorizados.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}