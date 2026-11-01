-- Proyecto académico: React + ASP.NET Core Web API + SQL Server.
-- No elimina bases de datos ni registros existentes.
USE master;
GO
IF DB_ID(N'CuentasPorCobrarUMG') IS NULL
    CREATE DATABASE CuentasPorCobrarUMG;
GO
USE CuentasPorCobrarUMG;
GO
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
CREATE TABLE dbo.Usuarios (
    Id int IDENTITY PRIMARY KEY,
    Nombre nvarchar(100) NOT NULL,
    Usuario nvarchar(50) NOT NULL UNIQUE,
    PasswordHash nvarchar(500) NOT NULL,
    Activo bit NOT NULL DEFAULT 1
);

IF OBJECT_ID(N'dbo.Parametros', N'U') IS NULL
CREATE TABLE dbo.Parametros (
    Id int NOT NULL PRIMARY KEY CHECK (Id = 1),
    NombreNegocio nvarchar(150) NOT NULL,
    Moneda nvarchar(5) NOT NULL DEFAULT N'Q',
    Telefono nvarchar(30) NOT NULL DEFAULT N'',
    Direccion nvarchar(250) NOT NULL DEFAULT N''
);

IF OBJECT_ID(N'dbo.Clientes', N'U') IS NULL
CREATE TABLE dbo.Clientes (
    Id int IDENTITY PRIMARY KEY,
    Nombre nvarchar(150) NOT NULL,
    Nit nvarchar(30) NOT NULL DEFAULT N'CF',
    Telefono nvarchar(30) NOT NULL DEFAULT N'',
    Correo nvarchar(150) NOT NULL DEFAULT N'',
    Direccion nvarchar(250) NOT NULL DEFAULT N'',
    Activo bit NOT NULL DEFAULT 1,
    CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.Facturas', N'U') IS NULL
CREATE TABLE dbo.Facturas (
    Id int IDENTITY PRIMARY KEY,
    ClienteId int NOT NULL REFERENCES dbo.Clientes(Id),
    Fecha date NOT NULL,
    Vencimiento date NOT NULL,
    Observaciones nvarchar(500) NOT NULL DEFAULT N'',
    Anulada bit NOT NULL DEFAULT 0,
    MotivoAnulacion nvarchar(300) NULL,
    AnuladaEn datetime2 NULL,
    UsuarioId int NOT NULL REFERENCES dbo.Usuarios(Id),
    CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Facturas_Fechas CHECK (Vencimiento >= Fecha),
    CONSTRAINT CK_Facturas_Anulacion CHECK (
        (Anulada = 0 AND MotivoAnulacion IS NULL AND AnuladaEn IS NULL) OR
        (Anulada = 1 AND LEN(LTRIM(RTRIM(MotivoAnulacion))) > 0
         AND MotivoAnulacion IS NOT NULL AND AnuladaEn IS NOT NULL)
    )
);

IF OBJECT_ID(N'dbo.DetallesFactura', N'U') IS NULL
CREATE TABLE dbo.DetallesFactura (
    Id int IDENTITY PRIMARY KEY,
    FacturaId int NOT NULL REFERENCES dbo.Facturas(Id),
    Descripcion nvarchar(200) NOT NULL,
    Cantidad decimal(12,2) NOT NULL CHECK (Cantidad > 0),
    PrecioUnitario decimal(12,2) NOT NULL CHECK (PrecioUnitario > 0),
    Subtotal AS CONVERT(decimal(18,2), ROUND(Cantidad * PrecioUnitario, 2)) PERSISTED
);

IF OBJECT_ID(N'dbo.Pagos', N'U') IS NULL
CREATE TABLE dbo.Pagos (
    Id int IDENTITY PRIMARY KEY,
    FacturaId int NOT NULL REFERENCES dbo.Facturas(Id),
    Fecha date NOT NULL,
    Monto decimal(18,2) NOT NULL CHECK (Monto > 0),
    Metodo nvarchar(20) NOT NULL CHECK (Metodo IN (N'Efectivo', N'Deposito')),
    Referencia nvarchar(100) NOT NULL DEFAULT N'',
    Anulado bit NOT NULL DEFAULT 0,
    MotivoAnulacion nvarchar(300) NULL,
    AnuladoEn datetime2 NULL,
    UsuarioId int NOT NULL REFERENCES dbo.Usuarios(Id),
    CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Pagos_Referencia CHECK (Metodo <> N'Deposito' OR LEN(LTRIM(RTRIM(Referencia))) > 0),
    CONSTRAINT CK_Pagos_Anulacion CHECK (
        (Anulado = 0 AND MotivoAnulacion IS NULL AND AnuladoEn IS NULL) OR
        (Anulado = 1 AND LEN(LTRIM(RTRIM(MotivoAnulacion))) > 0
         AND MotivoAnulacion IS NOT NULL AND AnuladoEn IS NOT NULL)
    )
);

IF NOT EXISTS (SELECT 1 FROM dbo.Parametros WHERE Id = 1)
    INSERT INTO dbo.Parametros (Id, NombreNegocio, Moneda)
    VALUES (1, N'Mi Negocio — Cuentas por Cobrar', N'Q');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Facturas_ClienteId' AND object_id = OBJECT_ID(N'dbo.Facturas'))
    CREATE INDEX IX_Facturas_ClienteId ON dbo.Facturas(ClienteId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DetallesFactura_FacturaId' AND object_id = OBJECT_ID(N'dbo.DetallesFactura'))
    CREATE INDEX IX_DetallesFactura_FacturaId ON dbo.DetallesFactura(FacturaId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Pagos_FacturaId' AND object_id = OBJECT_ID(N'dbo.Pagos'))
    CREATE INDEX IX_Pagos_FacturaId ON dbo.Pagos(FacturaId);

COMMIT TRANSACTION;
GO
-- Se suman detalles y pagos por separado para evitar duplicar importes.
CREATE OR ALTER VIEW dbo.vw_EstadoFacturas AS
SELECT f.Id, f.ClienteId, c.Nombre AS Cliente, f.Fecha, f.Vencimiento,
       f.Anulada, f.Observaciones,
       COALESCE(d.Total, CONVERT(decimal(18,2), 0)) AS Total,
       COALESCE(p.Pagado, CONVERT(decimal(18,2), 0)) AS Pagado,
       CASE WHEN f.Anulada = 1 THEN CONVERT(decimal(18,2), 0)
            ELSE COALESCE(d.Total, 0) - COALESCE(p.Pagado, 0) END AS Saldo
FROM dbo.Facturas f
JOIN dbo.Clientes c ON c.Id = f.ClienteId
OUTER APPLY (
    SELECT SUM(Subtotal) AS Total FROM dbo.DetallesFactura WHERE FacturaId = f.Id
) d
OUTER APPLY (
    SELECT SUM(Monto) AS Pagado FROM dbo.Pagos WHERE FacturaId = f.Id AND Anulado = 0
) p;
GO
SET NOCOUNT ON;
SELECT name AS TablaCreada FROM sys.tables ORDER BY name;
