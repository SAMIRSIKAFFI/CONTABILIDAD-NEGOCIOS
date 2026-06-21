import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";


export default function Balance() {
  const { config, ingresos, gastos, costos } = useApp();

  const allCats = new Set([...ingresos.map(x => x.categoria), ...gastos.map(x => x.categoria), ...costos.map(x => x.categoria)]);

  const rows = Array.from(allCats).filter(Boolean).sort().map(cat => {
    const ing = ingresos.filter(x => x.categoria === cat).reduce((s, x) => s + (x.totalNeto||0), 0);
    const gas = gastos.filter(x => x.categoria === cat).reduce((s, x) => s + (x.totalNeto||0), 0);
    const cos = costos.filter(x => x.categoria === cat).reduce((s, x) => s + (x.totalNeto||0), 0);
    return { cat, ing, gas, cos, balance: ing - gas - cos };
  });

  const totIng = ingresos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const totGas = gastos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const totCos = costos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const balanceTotal = totIng - totGas - totCos;

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">⚖️ Balance General</h1><p className="page-subtitle">Balance general de cuentas registradas</p></div></div>

      <div className="card" style={{ marginBottom: 24, textAlign: "center", padding: "32px 20px", background: "linear-gradient(135deg, #1a2240, #0d1b33)" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Balance Total</div>
        <div style={{ fontSize: 48, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: "'DM Serif Display', serif", color: balanceTotal >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{fmt(balanceTotal, config.currency)}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>Ingresos − Gastos − Costos = Balance</div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card"><div className="card-title">Total Ingresos</div><div className="stat-value green">{fmt(totIng, config.currency)}</div><div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{ingresos.length} registros</div></div>
        <div className="card"><div className="card-title">Total Gastos</div><div className="stat-value red">{fmt(totGas, config.currency)}</div><div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{gastos.length} registros</div></div>
        <div className="card"><div className="card-title">Total Costos</div><div className="stat-value yellow">{fmt(totCos, config.currency)}</div><div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{costos.length} registros</div></div>
      </div>

      <div className="card">
        <div className="section-title">Balance por Cuenta / Categoría</div>
        {rows.length === 0 ? (
          <div className="empty-state"><div className="icon">⚖️</div><p>No hay transacciones registradas aún</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cuenta / Categoría</th><th>Ingresos</th><th>Gastos</th><th>Costos</th><th>Balance</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.cat}>
                    <td style={{ fontWeight: 600, color: "var(--text)" }}>{row.cat}</td>
                    <td className="num-positive">{fmt(row.ing, config.currency)}</td>
                    <td className="num-negative">{fmt(row.gas, config.currency)}</td>
                    <td style={{ color: "var(--accent-yellow)", fontVariantNumeric: "tabular-nums" }}>{fmt(row.cos, config.currency)}</td>
                    <td style={{ color: row.balance >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{row.balance >= 0 ? "+" : ""}{fmt(row.balance, config.currency)}</td>
                  </tr>
                ))}
                <tr style={{ background: "rgba(79,142,247,0.07)", fontWeight: 700 }}>
                  <td style={{ color: "var(--text)" }}>BALANCE TOTAL</td>
                  <td className="num-positive">{fmt(totIng, config.currency)}</td>
                  <td className="num-negative">{fmt(totGas, config.currency)}</td>
                  <td style={{ color: "var(--accent-yellow)", fontVariantNumeric: "tabular-nums" }}>{fmt(totCos, config.currency)}</td>
                  <td style={{ color: balanceTotal >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 16 }}>{balanceTotal >= 0 ? "+" : ""}{fmt(balanceTotal, config.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <DistributionCard title="Distribución de Ingresos" items={config.categoriasIngresos.map(cat => ({ cat, val: ingresos.filter(x => x.categoria === cat).reduce((s, x) => s + (x.totalNeto||0), 0) })).filter(x => x.val > 0)} total={totIng} cur={config.currency} color="var(--accent-green)" />
        <DistributionCard title="Distribución de Egresos" items={[
          ...config.categoriasGastos.map(cat => ({ cat: `G: ${cat}`, val: gastos.filter(x => x.categoria === cat).reduce((s, x) => s + (x.totalNeto||0), 0) })),
          ...config.categoriasCostos.map(cat => ({ cat: `C: ${cat}`, val: costos.filter(x => x.categoria === cat).reduce((s, x) => s + (x.totalNeto||0), 0) }))
        ].filter(x => x.val > 0)} total={totGas + totCos} cur={config.currency} color="var(--accent-red)" />
      </div>
    </div>
  );
}

function DistributionCard({ title, items, total, cur, color }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {items.length === 0 ? <p style={{ color: "var(--text3)", fontSize: 13 }}>Sin datos</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(({ cat, val }) => {
            const pct = total > 0 ? (val / total) * 100 : 0;
            return (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--text2)" }}>{cat}</span>
                  <div style={{ display: "flex", gap: 10 }}><span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmt(val, cur)}</span><span style={{ color: "var(--text3)" }}>{pct.toFixed(1)}%</span></div>
                </div>
                <div className="progress-bar"><div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width 0.5s" }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
