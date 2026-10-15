// 관리자 화면 공용 UI (시환로그 크림·코랄·세이지 톤 유지)
export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return (
    <p
      role={err ? 'alert' : 'status'}
      className={`mb-4 rounded-xl px-4 py-3 text-sm ${err ? 'bg-rose-50 text-rose-800' : 'bg-sage-light text-emerald-900'}`}
    >
      {err ?? msg}
    </p>
  );
}

export const inputCls =
  'h-11 w-full rounded-xl border border-sand bg-cream px-3 text-base focus:border-coral focus:outline-none';
export const btnPrimary =
  'inline-flex h-11 items-center justify-center rounded-full bg-coral px-5 text-sm font-bold text-white hover:bg-coral-dark';
export const btnGhost =
  'inline-flex h-11 items-center justify-center rounded-full border-2 border-sand bg-white px-5 text-sm font-semibold hover:border-sage hover:bg-sage-light';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-sand bg-white p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
