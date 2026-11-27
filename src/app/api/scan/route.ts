import { NextRequest, NextResponse } from 'next/server';
import { doorPickService } from '@/lib/doorpick-service';
import { LineId } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo JSON inválido.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Se requiere un objeto JSON con { line, qr }.' },
        { status: 400 }
      );
    }

    const { line, qr } = body as { line?: unknown; qr?: unknown };
    if (line !== 'A' && line !== 'B') {
      return NextResponse.json(
        { error: "Campo 'line' inválido. Debe ser 'A' o 'B'." },
        { status: 400 }
      );
    }

    if (typeof qr !== 'string' || qr.trim().length === 0) {
      return NextResponse.json(
        { error: "Campo 'qr' inválido. Debe ser una cadena no vacía." },
        { status: 400 }
      );
    }

    const result = await doorPickService.processQrScan(line as LineId, qr);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error en POST /api/scan:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar el escaneo QR.' },
      { status: 500 }
    );
  }
}
