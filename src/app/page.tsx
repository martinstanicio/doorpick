import { Suspense } from 'react';
import { DoorPickBoard } from '@/components/DoorPickBoard';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white text-black flex items-center justify-center font-mono text-sm font-bold tracking-widest">
          CARGANDO DOORPICK...
        </div>
      }
    >
      <DoorPickBoard />
    </Suspense>
  );
}
