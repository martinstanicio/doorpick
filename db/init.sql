IF DB_ID(N'TB-L') IS NULL
BEGIN
    CREATE DATABASE [TB-L];
END
GO

USE [TB-L];
GO

IF OBJECT_ID(N'dbo.Orden_Produccion', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Orden_Produccion] (
        [ID_OrdenProduccion] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Secuencia] INT NOT NULL,
        [Fecha_Proceso] DATETIME2(0) NOT NULL,
        [SD] VARCHAR(20) NOT NULL,
        [Puesto] VARCHAR(10) NOT NULL,
        [Estado] TINYINT NOT NULL,
        [Mano] CHAR(2) NOT NULL,
        [Posicion] CHAR(2) NOT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.DoorPick', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DoorPick] (
        [ID_DoorPick] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Fecha_Inicio_Evaluacion] DATETIME2(0) NOT NULL,
        [FRLH] CHAR(1) NULL CONSTRAINT CK_DoorPick_FRLH CHECK ([FRLH] IN ('A', 'B')),
        [FRRH] CHAR(1) NULL CONSTRAINT CK_DoorPick_FRRH CHECK ([FRRH] IN ('A', 'B')),
        [RRLH] CHAR(1) NULL CONSTRAINT CK_DoorPick_RRLH CHECK ([RRLH] IN ('A', 'B')),
        [RRRH] CHAR(1) NULL CONSTRAINT CK_DoorPick_RRRH CHECK ([RRRH] IN ('A', 'B')),
        [Segundos_Panel_Correcto] INT NOT NULL CONSTRAINT DF_DoorPick_SegundosPanelCorrecto DEFAULT ((10)) CONSTRAINT CK_DoorPick_SegundosPanelCorrecto CHECK ([Segundos_Panel_Correcto] >= 1 AND [Segundos_Panel_Correcto] <= 300),
        [Fecha_Actualizacion] DATETIME2(0) NOT NULL CONSTRAINT DF_DoorPick_FechaActualizacion DEFAULT SYSDATETIME()
    );

    CREATE INDEX IX_DoorPick_FechaActualizacion
        ON [dbo].[DoorPick] ([Fecha_Actualizacion] DESC, [ID_DoorPick] DESC);
END
GO
