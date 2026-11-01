# Cuentas por cobrar — UMG

Proyecto académico de Desarrollo Web. Aplicación para administrar clientes, ventas al crédito, pagos y estados de cuenta.

## Tecnologías

- React y Vite para la interfaz.
- ASP.NET Core Web API sobre .NET 10 para el servidor.
- Microsoft SQL Server para el almacenamiento.
- Autenticación mediante cookies y contraseñas almacenadas con hash.

## Funciones

- Inicio y cierre de sesión.
- Registro, edición, desactivación y reactivación de clientes.
- Eliminación definitiva de un cliente y sus movimientos, con confirmación escrita.
- Facturas con varios conceptos y cálculo de saldos.
- Cobros en efectivo o por depósito con referencia.
- Validación de pagos contra el saldo y anulación con motivo.
- Estados de cuenta e historial imprimibles o guardables como PDF desde el navegador.
- Archivo y restauración del historial.
- Parámetros del negocio: nombre, NIT, teléfono, dirección y moneda Q.

Los apartados operativos, indicadores y nuevos reportes muestran únicamente clientes activos. Desactivar conserva los movimientos; reactivar permite consultarlos otra vez. Archivar oculta registros de las listas habituales sin alterar las deudas. Eliminar es definitivo y también elimina facturas, detalles y pagos del cliente.

## Estructura

```text
cuentas-por-cobrar-web/   Interfaz React
CuentasPorCobrar.Api/    Servidor ASP.NET Core
database/               Scripts SQL de creación y actualización
```

## Requisitos

- Windows y SQL Server con una instancia disponible.
- SDK de .NET 10.
- Node.js compatible con Vite 8 (20.19+ o 22.12+).
- SQL Server Management Studio o una herramienta para ejecutar los scripts SQL.

## Ejecución local

### 1. Crear la base de datos

En SQL Server Management Studio ejecuta, en este orden:

1. `database/01-crear-base.sql`
2. `database/02-archivo-historial.sql`
3. `database/03-nit-negocio.sql`

La base se llama `CuentasPorCobrarUMG`. Los scripts no incluyen datos personales ni usuarios con contraseñas predefinidas.

La conexión local está en `CuentasPorCobrar.Api/appsettings.json`. Utiliza autenticación de Windows y la instancia `localhost`. Ajusta el servidor si utilizas una instancia con nombre. `TrustServerCertificate=True` es una configuración para este entorno local.

### 2. Preparar la interfaz

Desde la carpeta raíz del repositorio, en PowerShell:

```powershell
cd .\cuentas-por-cobrar-web
npm.cmd ci
npm.cmd run build
New-Item -ItemType Directory -Force ..\CuentasPorCobrar.Api\wwwroot | Out-Null
Copy-Item -Path .\dist\* -Destination ..\CuentasPorCobrar.Api\wwwroot -Recurse -Force
cd ..
```

### 3. Crear el administrador y encender la aplicación

En el primer inicio, si no hay usuarios, se crea el usuario `admin`. Define una contraseña propia de al menos 10 caracteres en la misma ventana de PowerShell:

```powershell
$claveInicial = Read-Host 'Contraseña inicial de administrador (mínimo 10 caracteres)' -AsSecureString
$env:CC_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $claveInicial).Password
dotnet run --project .\CuentasPorCobrar.Api --urls http://localhost:5050
```

Abre `http://localhost:5050` e inicia sesión con `admin` y la contraseña elegida. La variable solo se utiliza al crear el primer usuario. En posteriores inicios basta con ejecutar el comando `dotnet run` anterior. Mantén SQL Server y el servidor de la aplicación encendidos.

Para detener el servidor, presiona Ctrl+C. Después puedes quitar la variable de la sesión:

```powershell
Remove-Item Env:CC_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

### Desarrollo de la interfaz

Con la API en el puerto 5050, ejecuta `npm.cmd run dev` dentro de `cuentas-por-cobrar-web`. Vite utiliza el puerto 5173 y redirige las solicitudes `/api` al servidor local. Para actualizar la versión integrada del puerto 5050, vuelve a compilar y copiar `dist` a `wwwroot`.

## Alcance

Esta solución realiza control interno de cuentas por cobrar. No incorpora certificación FEL, integración bancaria ni conciliación automática. Los PDF son copias de consulta, no respaldos restaurables de SQL Server.

Publicar el código en GitHub no publica la aplicación en Internet. Este repositorio contiene el código y los scripts necesarios para ejecutarla localmente; no incluye la base con registros, contraseñas, dependencias descargadas ni archivos compilados.
