import Link from "next/link";

export function CustomerAuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-offwhite">
      <section className="mx-auto flex min-h-[calc(100vh-220px)] max-w-wrap items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-[460px] rounded-md border border-line bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.06)] sm:p-8">
          <Link href="/" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
            Modern Orthodontics
          </Link>
          <h1 className="mt-5 text-[30px] font-semibold leading-tight text-ink">{title}</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-steel">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </main>
  );
}
