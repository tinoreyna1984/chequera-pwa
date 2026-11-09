import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-surface px-5 py-8 text-ink sm:px-10">
      <nav className="mb-10 flex items-center justify-between border-b border-line pb-4 text-sm" aria-label="Navegación principal">
        <Link className="font-bold text-accent" href="/">Inicio</Link>
        <Link className="text-accent hover:underline" href="/about">Acerca del app</Link>
      </nav>
      <h1 className="text-3xl font-bold text-ink-strong">Acerca del app</h1>
      <section className="mt-6 space-y-5 text-lg leading-8">
        <h2 className="text-2xl font-semibold text-accent">Charles H. Spurgeon</h2>
        <p>Charles Haddon Spurgeon (1834–1892) fue un pastor y predicador bautista inglés, conocido como el “Príncipe de los Predicadores”. Sus escritos destacan por su claridad, profundidad bíblica y confianza en la gracia de Dios.</p>
        <p><em>Chequera del Banco de la Fe</em> reúne una promesa bíblica y una reflexión para cada día del año, basada en la obra devocional de Spurgeon.</p>
        <h2 className="text-2xl font-semibold text-accent">Sobre esta aplicación</h2>
        <p>Esta aplicación es una PWA gratuita, instalable y preparada para funcionar sin conexión. Puedes navegar por cualquier fecha, ajustar la apariencia y configurar un recordatorio diario desde tu dispositivo.</p>
      </section>
    </main>
  );
}
