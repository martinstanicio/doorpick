import { NextRequest, NextResponse } from 'next/server';
import { doorPickService } from '@/lib/doorpick-service';
import { validateConfigInput } from '@/lib/qr';
import { DoorPickConfigInput } from '@/lib/types';

export async function GET() {
  try {
    const config = await doorPickService.getConfig();
    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    console.error('Error en GET /api/config:', error);
    return NextResponse.json(
      { error: 'Error interno al obtener la configuración.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const validation = validateConfigInput(body as DoorPickConfigInput);
    if (!validation.valid || !validation.normalized) {
      return NextResponse.json(
        { error: validation.error ?? 'Configuración inválida.' },
        { status: 400 }
      );
    }

    const saved = await doorPickService.saveConfig(validation.normalized);
    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    console.error('Error en PUT /api/config:', error);
    return NextResponse.json(
      { error: 'Error interno al guardar la configuración.' },
      { status: 500 }
    );
  }
}
