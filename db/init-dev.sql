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

-- Configuración inicial de ejemplo (solo si está vacía)
IF NOT EXISTS (SELECT 1 FROM [dbo].[DoorPick])
BEGIN
    INSERT INTO [dbo].[DoorPick] (
        [Fecha_Inicio_Evaluacion],
        [FRLH],
        [FRRH],
        [RRLH],
        [RRRH],
        [Segundos_Panel_Correcto],
        [Fecha_Actualizacion]
    )
    VALUES (
        '2026-11-27T06:00:00',
        'A',
        'B',
        'B',
        'A',
        10,
        SYSDATETIME()
    );
END
GO

-- Datos semilla de prueba (solo si está vacía)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Orden_Produccion])
BEGIN
    SET IDENTITY_INSERT [dbo].[Orden_Produccion] ON;

    INSERT INTO [dbo].[Orden_Produccion] (
        [ID_OrdenProduccion], [Secuencia], [Fecha_Proceso], [SD], [Puesto], [Estado], [Mano], [Posicion]
    )
    VALUES
        -- Anteriores a Fecha_Inicio_Evaluacion (deben ignorarse)
        (10001, 102, '2026-11-27T05:30:00', 'D3L', 'DL01', 0, 'RH', 'FR'),
        (10002, 102, '2026-11-27T05:31:00', 'D3L', 'DL01', 0, 'LH', 'FR'),
        -- Ya procesados (Estado 2 y 3, deben ignorarse)
        (10003, 103, '2026-11-27T06:10:00', 'D3L', 'DL01', 2, 'RH', 'FR'),
        (10004, 103, '2026-11-27T06:11:00', 'D3L', 'DL01', 3, 'LH', 'FR'),
        -- Otro puesto (debe ignorarse)
        (10005, 104, '2026-11-27T06:15:00', 'D3L', 'DL02', 0, 'RH', 'FR'),

        -- Secuencia 104 (Doble cabina) - Activa
        (10010, 104, '2026-11-27T06:20:00', 'D3L', 'DL01', 0, 'LH', 'FR'), -- FRLH (A, DOBLADORA)
        (10011, 104, '2026-11-27T06:20:00', 'D3L', 'DL01', 0, 'RH', 'FR'), -- FRRH (B, DOBLADORA)
        (10012, 104, '2026-11-27T06:21:00', 'D3L', 'DL01', 0, 'LH', 'RR'), -- RRLH (B, DOBLADORA)
        (10013, 104, '2026-11-27T06:21:00', 'D3L', 'DL01', 0, 'RH', 'RR'), -- RRRH (A, DOBLADORA)

        -- Secuencia 105 (Cabina simple)
        (10014, 105, '2026-11-27T06:25:00', 'S1X', 'DL01', 0, 'LH', 'FR'), -- FRLH (A, DOBLADORA)
        (10015, 105, '2026-11-27T06:25:00', 'S1X', 'DL01', 0, 'RH', 'FR'), -- FRRH (B, DOBLADORA)

        -- Secuencia 106 (Doble cabina, mix STOCK)
        (10016, 106, '2026-11-27T06:30:00', 'D4K', 'DL01', 1, 'LH', 'FR'), -- FRLH (A, STOCK)
        (10017, 106, '2026-11-27T06:30:00', 'D4K', 'DL01', 0, 'RH', 'FR'), -- FRRH (B, DOBLADORA)
        (10018, 106, '2026-11-27T06:31:00', 'D4K', 'DL01', 1, 'LH', 'RR'), -- RRLH (B, STOCK)
        (10019, 106, '2026-11-27T06:31:00', 'D4K', 'DL01', 0, 'RH', 'RR'), -- RRRH (A, DOBLADORA)

        -- Secuencia 107 (Doble cabina)
        (10020, 107, '2026-11-27T06:35:00', 'D3L', 'DL01', 0, 'LH', 'FR'), -- FRLH (A, DOBLADORA)
        (10021, 107, '2026-11-27T06:35:00', 'D3L', 'DL01', 1, 'RH', 'FR'), -- FRRH (B, STOCK)
        (10022, 107, '2026-11-27T06:36:00', 'D3L', 'DL01', 0, 'LH', 'RR'), -- RRLH (B, DOBLADORA)
        (10023, 107, '2026-11-27T06:36:00', 'D3L', 'DL01', 1, 'RH', 'RR'); -- RRRH (A, STOCK)

    SET IDENTITY_INSERT [dbo].[Orden_Produccion] OFF;
END
GO
