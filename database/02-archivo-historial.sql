USE CuentasPorCobrarUMG;
GO
-- Cambio aditivo: todos los registros existentes permanecen sin archivar.
IF COL_LENGTH('dbo.Facturas', 'Archivada') IS NULL
    ALTER TABLE dbo.Facturas ADD Archivada bit NOT NULL
        CONSTRAINT DF_Facturas_Archivada DEFAULT 0;
GO
