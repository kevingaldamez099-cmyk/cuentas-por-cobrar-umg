USE CuentasPorCobrarUMG;
GO
IF COL_LENGTH('dbo.Parametros', 'Nit') IS NULL
    ALTER TABLE dbo.Parametros ADD Nit nvarchar(30) NOT NULL
        CONSTRAINT DF_Parametros_Nit DEFAULT N'';
GO
