export async function api(ruta, opciones = {}) {
  let respuesta

  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...opciones,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...opciones.headers,
      },
    })
  } catch {
    throw new Error('No se pudo conectar. Comprueba que los servidores estén encendidos.')
  }

  const texto = await respuesta.text()
  let datos = null

  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    // Algunos errores del servidor no tienen formato JSON.
  }

  if (!respuesta.ok) {
    const validaciones = datos?.errors
      ? Object.values(datos.errors).flat().join(' ')
      : ''

    const error = new Error(
      datos?.mensaje ||
      validaciones ||
      (respuesta.status === 401
        ? 'Debes iniciar sesión para continuar.'
        : 'No se pudo completar la operación. Revisa la ventana de la API.')
    )

    error.status = respuesta.status
    throw error
  }

  return datos
}