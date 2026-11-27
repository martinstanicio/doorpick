import { connection, NextRequest, NextResponse } from 'next/server';
import { doorPickService } from '@/lib/doorpick-service';
import { LineId } from '@/lib/types';

function parseLine(value: string | null): LineId | null {
  if (value === 'A' || value === 'B') {
    return value;
  }
  return null;
}

export async function GET(request: NextRequest) {
  await connection();
  try {
    const lineParam = request.nextUrl.searchParams.get('line');
    const line = parseLine(lineParam);
    if (!line) {
      return NextResponse.json(
        { error: "Parámetro 'line' inválido. Debe ser 'A' o 'B'." },
        { status: 400 }
      );
    }

    const queue = await doorPickService.getQueueForLine(line);
    return NextResponse.json(queue, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error en GET /api/panels:', error);
    return NextResponse.json(
      { error: 'Error interno al obtener la cola de paneles.' },
      { status: 500 }
    );
  }
}
