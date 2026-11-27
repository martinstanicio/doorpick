import sql from 'mssql';
import { getPool } from './db';
import { formatLocalDateTime, splitPanelCode } from './qr';
import {
  DoorPickConfig,
  DoorPickConfigInput,
  LineAssignment,
  PanelCode,
  PanelHand,
  PanelItem,
  PanelPosition,
  PanelSource,
  PanelStatusCode,
} from './types';

export interface DoorPickRepository {
  getLatestConfig(): Promise<DoorPickConfig>;
  insertConfig(input: DoorPickConfigInput): Promise<DoorPickConfig>;
  getPendingPanels(
    fechaInicio: string,
    panelCodes: PanelCode[],
    limit?: number
  ): Promise<PanelItem[]>;
  markPanelProcessed(
    idOrdenProduccion: number,
    expectedEstado: 0 | 1,
    nextEstado: 2 | 3
  ): Promise<boolean>;
}

interface DoorPickRow {
  ID_DoorPick: number;
  Fecha_Inicio_Evaluacion: Date | string;
  FRLH: string | null;
  FRRH: string | null;
  RRLH: string | null;
  RRRH: string | null;
  Fecha_Actualizacion: Date | string;
}

interface OrdenProduccionRow {
  ID_OrdenProduccion: number;
  Secuencia: number;
  Fecha_Proceso: Date | string;
  SD: string;
  Estado: number;
  Mano: string;
  Posicion: string;
}

function toLocalDateTimeString(value: Date | string): string {
  if (value instanceof Date) {
    return formatLocalDateTime(value);
  }
  return String(value);
}

function toLineAssignment(value: string | null): LineAssignment {
  if (value === 'A' || value === 'B') {
    return value;
  }
  return null;
}

function mapConfigRow(row: DoorPickRow): DoorPickConfig {
  return {
    idDoorPick: row.ID_DoorPick,
    fechaInicioEvaluacion: toLocalDateTimeString(row.Fecha_Inicio_Evaluacion),
    assignments: {
      FRLH: toLineAssignment(row.FRLH),
      FRRH: toLineAssignment(row.FRRH),
      RRLH: toLineAssignment(row.RRLH),
      RRRH: toLineAssignment(row.RRRH),
    },
    fechaActualizacion: toLocalDateTimeString(row.Fecha_Actualizacion),
  };
}

function mapPanelRow(row: OrdenProduccionRow): PanelItem {
  const posicion = row.Posicion.trim().toUpperCase() as PanelPosition;
  const mano = row.Mano.trim().toUpperCase() as PanelHand;
  const estado = Number(row.Estado) as PanelStatusCode;
  const ubicacion: PanelSource = estado === 1 ? 'STOCK' : 'DOBLADORA';

  return {
    idOrdenProduccion: Number(row.ID_OrdenProduccion),
    secuencia: Number(row.Secuencia),
    fechaProceso: toLocalDateTimeString(row.Fecha_Proceso),
    sd: String(row.SD).trim(),
    estado,
    mano,
    posicion,
    codigoPanel: `${posicion}${mano}` as PanelCode,
    ubicacion,
  };
}

export class SqlServerDoorPickRepository implements DoorPickRepository {
  async getLatestConfig(): Promise<DoorPickConfig> {
    const pool = await getPool();
    const result = await pool.request().query<DoorPickRow>(`
      SELECT TOP 1
        [ID_DoorPick],
        [Fecha_Inicio_Evaluacion],
        [FRLH],
        [FRRH],
        [RRLH],
        [RRRH],
        [Fecha_Actualizacion]
      FROM [dbo].[DoorPick]
      ORDER BY [Fecha_Actualizacion] DESC, [ID_DoorPick] DESC
    `);

    const row = result.recordset[0];
    if (!row) {
      throw new Error('No se encontró configuración en [dbo].[DoorPick].');
    }

    return mapConfigRow(row);
  }

  async insertConfig(input: DoorPickConfigInput): Promise<DoorPickConfig> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('fechaInicio', sql.VarChar(19), input.fechaInicioEvaluacion)
      .input('frlh', sql.Char(1), input.assignments.FRLH)
      .input('frrh', sql.Char(1), input.assignments.FRRH)
      .input('rrlh', sql.Char(1), input.assignments.RRLH)
      .input('rrrh', sql.Char(1), input.assignments.RRRH)
      .query<DoorPickRow>(`
        INSERT INTO [dbo].[DoorPick] (
          [Fecha_Inicio_Evaluacion],
          [FRLH],
          [FRRH],
          [RRLH],
          [RRRH],
          [Fecha_Actualizacion]
        )
        OUTPUT
          INSERTED.[ID_DoorPick],
          INSERTED.[Fecha_Inicio_Evaluacion],
          INSERTED.[FRLH],
          INSERTED.[FRRH],
          INSERTED.[RRLH],
          INSERTED.[RRRH],
          INSERTED.[Fecha_Actualizacion]
        VALUES (
          CAST(@fechaInicio AS DATETIME2(0)),
          @frlh,
          @frrh,
          @rrlh,
          @rrrh,
          SYSDATETIME()
        )
      `);

    const row = result.recordset[0];
    if (!row) {
      throw new Error('No se pudo insertar la configuración en [dbo].[DoorPick].');
    }

    return mapConfigRow(row);
  }

  async getPendingPanels(
    fechaInicio: string,
    panelCodes: PanelCode[],
    limit?: number
  ): Promise<PanelItem[]> {
    if (panelCodes.length === 0 || (limit !== undefined && limit <= 0)) {
      return [];
    }

    const pool = await getPool();
    const request = pool
      .request()
      .input('fechaInicio', sql.VarChar(19), fechaInicio);

    if (limit !== undefined) {
      request.input('limit', sql.Int, limit);
    }

    const panelClauses: string[] = [];
    panelCodes.forEach((code, idx) => {
      const { posicion, mano } = splitPanelCode(code);
      const posParam = `pos${idx}`;
      const manoParam = `mano${idx}`;
      request.input(posParam, sql.VarChar(2), posicion);
      request.input(manoParam, sql.VarChar(2), mano);
      panelClauses.push(`([Posicion] = @${posParam} AND [Mano] = @${manoParam})`);
    });

    const topClause = limit !== undefined ? 'TOP (@limit)' : '';
    const result = await request.query<OrdenProduccionRow>(`
      SELECT ${topClause}
        [ID_OrdenProduccion],
        [Secuencia],
        [Fecha_Proceso],
        [SD],
        [Estado],
        [Mano],
        [Posicion]
      FROM [dbo].[Orden_Produccion]
      WHERE [Puesto] = 'DL01'
        AND [Fecha_Proceso] > CAST(@fechaInicio AS DATETIME2(0))
        AND [Estado] IN (0, 1)
        AND (${panelClauses.join(' OR ')})
      ORDER BY
        [Fecha_Proceso] ASC,
        CASE WHEN [Posicion] = 'FR' THEN 0 ELSE 1 END ASC,
        [Mano] ASC,
        [ID_OrdenProduccion] ASC
    `);

    return result.recordset.map(mapPanelRow);
  }

  async markPanelProcessed(
    idOrdenProduccion: number,
    expectedEstado: 0 | 1,
    nextEstado: 2 | 3
  ): Promise<boolean> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, idOrdenProduccion)
      .input('expectedEstado', sql.Int, expectedEstado)
      .input('nextEstado', sql.Int, nextEstado)
      .query(`
        UPDATE [dbo].[Orden_Produccion]
        SET [Estado] = @nextEstado
        WHERE [ID_OrdenProduccion] = @id
          AND [Estado] = @expectedEstado
      `);

    return (result.rowsAffected[0] ?? 0) === 1;
  }
}
