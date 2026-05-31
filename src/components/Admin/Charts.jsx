// Lightweight, dependency-free charts (CSS bars).

export function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-forest/15 bg-white p-4">
      <p className="text-2xl font-semibold text-forest">{value}</p>
      <p className="text-sm text-forest/60">{label}</p>
      {sub && <p className="mt-1 text-xs text-forest/45">{sub}</p>}
    </div>
  )
}

// data: [{ label, value }]
export function Bars({ data, accent = 'bg-forest', empty = 'No data yet.' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length) return <p className="text-sm text-forest/50">{empty}</p>
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-right text-sm text-forest/70">{d.label}</div>
          <div className="flex-1">
            <div className="h-5 rounded bg-forest/[0.06]">
              <div className={`h-5 rounded ${accent}`} style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
          </div>
          <div className="w-10 text-sm tabular-nums text-forest/80">{d.value}</div>
        </div>
      ))}
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-forest">{title}</h2>
      {children}
    </section>
  )
}
