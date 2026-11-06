import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center bg-[#fffdf8] px-6 text-center text-stone-800">
      <h1 className="text-3xl font-bold text-stone-900">Sin conexión</h1>
      <p className="mt-4 text-lg">No hay conexión disponible. Vuelve a intentarlo; los devocionales visitados pueden seguir disponibles sin conexión.</p>
      <Link href="/" className="mt-6 rounded bg-amber-700 px-5 py-2 text-white">Volver al inicio</Link>
    </main>
  );
}
