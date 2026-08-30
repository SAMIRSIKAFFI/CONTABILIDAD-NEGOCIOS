import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { fmt } from "../utils/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  RadialBarChart, RadialBar,
} from "recharts";

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const COLORS_PIE = ["#4f8ef7","#f7566a","#f9c846","#2dd4a0","#a78bfa","#fb923c","#34d399","#e879f9"];

// ─── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "var(--text)", letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3)" }}>{sub}</div>}
    </div>
  );
}

// ─── Alert Item ────────────────────────────────────────────────
function Alert({ type, text }) {
  const styles = {
    warn:  { bg: "rgba(249,200,70,0.12)",  border: "rgba(249,200,70,0.4)",  color: "#a87c0a", icon: "⚠️" },
    error: { bg: "rgba(247,86,106,0.10)",  border: "rgba(247,86,106,0.35)", color: "#d63348", icon: "🔴" },
    info:  { bg: "rgba(79,142,247,0.10)",  border: "rgba(79,142,247,0.3)",  color: "#3a7af0", icon: "📌" },
    ok:    { bg: "rgba(45,212,160,0.10)",  border: "rgba(45,212,160,0.3)",  color: "#0d9e72", icon: "✅" },
  };
  const s = styles[type] || styles.info;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, marginBottom: 6 }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{s.icon}</span>
      <span style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{text}</span>
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────
function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{fmt(p.value, currency)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { config, ingresos, gastos, costos, periods, getTotalesPorPeriodo, templates, getPendingTemplates, getTaxForecast, getTaxPayment } = useApp();
  const cur = config.currency;

  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  // ── Totales del mes actual ──────────────────────────────────
  const mesActual = getTotalesPorPeriodo(curMonth, curYear);

  // ── Meta anual ─────────────────────────────────────────────
  const goal = config.annualGoal || 0;
  const gananciaAnual = periods.reduce((sum, p) => {
    const t = getTotalesPorPeriodo(p.month, p.year);
    return sum + t.ganancia;
  }, 0);
  const pctMeta = goal > 0 ? Math.min(100, Math.round((gananciaAnual / goal) * 100)) : 0;

  // ── Datos para gráfico de barras (últimos 6 meses) ─────────
  const last6 = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      let m = curMonth - i;
      let y = curYear;
      if (m <= 0) { m += 12; y -= 1; }
      const t = getTotalesPorPeriodo(m, y);
      result.push({
        name: MONTHS_ES[m - 1],
        Ingresos: Math.round(t.ingresosBrutos || 0),
        Gastos: Math.round(t.gastosTotales || 0),
        Costos: Math.round(t.costosTotales || 0),
        Utilidad: Math.round(t.ganancia || 0),
      });
    }
    return result;
  }, [ingresos, gastos, costos, curMonth, curYear]);

  // ── Datos para gráfico de área (flujo acumulado) ───────────
  const flujoData = useMemo(() => {
    let acum = 0;
    return last6.map(d => {
      acum += d.Utilidad;
      return { name: d.name, Acumulado: acum };
    });
  }, [last6]);

  // ── Datos para torta (distribución por categoría ingresos) ─
  const pieData = useMemo(() => {
    const map = {};
    ingresos.forEach(x => {
      if (!map[x.categoria]) map[x.categoria] = 0;
      map[x.categoria] += x.ingresoTotal || 0;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [ingresos]);

  // ── Gauge meta anual ────────────────────────────────────────
  const gaugeData = [{ name: "Meta", value: pctMeta, fill: pctMeta >= 100 ? "#0d9e72" : pctMeta >= 60 ? "#4f8ef7" : "#f7566a" }];

  // ── Alertas ─────────────────────────────────────────────────
  const alertas = useMemo(() => {
    const list = [];
    const today = new Date(); today.setHours(0,0,0,0);

    // Plantillas pendientes del mes actual
    const pendTpl = [
      ...getPendingTemplates("ingreso", curMonth, curYear),
      ...getPendingTemplates("gasto",   curMonth, curYear),
      ...getPendingTemplates("costo",   curMonth, curYear),
    ];
    if (pendTpl.length > 0) list.push({ type: "info", text: `${pendTpl.length} plantilla(s) recurrente(s) sin registrar este mes` });

    // ── IVA/IT: se verifican sobre el MES ANTERIOR (ya vencido o a punto de vencer)
    // El impuesto del mes M se paga el 16 del mes M+1
    const checkTaxMonth = (m, y) => {
      const deadline = new Date(m === 12 ? y + 1 : y,
        m === 12 ? 0 : m, 16); // día 16 del mes M+1 (el año siempre avanza en diciembre, sin importar si y===curYear)
      const isPast    = today > deadline;
      const daysLeft  = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const label = MONTHS_ES[m - 1];
      const deadlineLabel = `16/${m === 12 ? 1 : m + 1}/${m === 12 ? y + 1 : y}`;

      const ivaF = getTaxForecast("iva", m, y);
      const ivaP = getTaxPayment("iva", key);
      if (ivaF > 0) {
        if (ivaP) list.push({ type: "ok",   text: `IVA de ${label}: PAGADO ✓ — ${fmt(ivaP.real_paid, cur)} el ${ivaP.paid_date || ""}` });
        else if (isPast) list.push({ type: "error", text: `IVA de ${label} VENCIDO — debía pagarse el ${deadlineLabel}` });
        else if (daysLeft <= 10) list.push({ type: "warn", text: `IVA de ${label} — vence el ${deadlineLabel} (${daysLeft} días)` });
        else list.push({ type: "info", text: `IVA de ${label} previsto: ${fmt(ivaF, cur)} — vence ${deadlineLabel}` });
      }

      const itF = getTaxForecast("it", m, y);
      const itP = getTaxPayment("it", key);
      if (itF > 0) {
        if (itP) list.push({ type: "ok",   text: `IT de ${label}: PAGADO ✓ — ${fmt(itP.real_paid, cur)}` });
        else if (isPast) list.push({ type: "error", text: `IT de ${label} VENCIDO — debía pagarse el ${deadlineLabel}` });
        else if (daysLeft <= 10) list.push({ type: "warn", text: `IT de ${label} — vence el ${deadlineLabel} (${daysLeft} días)` });
        else list.push({ type: "info", text: `IT de ${label} previsto: ${fmt(itF, cur)} — vence ${deadlineLabel}` });
      }
    };

    // Verificar mes anterior (ya debería estar pagado)
    const prevM = curMonth === 1 ? 12 : curMonth - 1;
    const prevY = curMonth === 1 ? curYear - 1 : curYear;
    checkTaxMonth(prevM, prevY);

    // Verificar mes actual (próximo vencimiento, para alertar con anticipación)
    checkTaxMonth(curMonth, curYear);

    // ── RC-IVA: verificar el trimestre actual y el anterior
    const curQ = Math.ceil(curMonth / 3);
    const rcQKey = `${curYear}-Q${curQ}`;
    const rcDeadlineMonth = curQ === 4 ? 1 : curQ * 3 + 1;
    const rcDeadlineYear  = curQ === 4 ? curYear + 1 : curYear;
    const rcDeadline = new Date(rcDeadlineYear, rcDeadlineMonth - 1, 16);
    const rcF = getTaxForecast ? [1,2,3].map(i => {
      const m = (curQ-1)*3 + i; return getTaxForecast("rciva", m, curYear);
    }).reduce((a,b) => a+b, 0) : 0;
    const rcP = getTaxPayment("rciva", rcQKey);
    const rcPast = today > rcDeadline;
    const rcDays = Math.ceil((rcDeadline - today) / (1000 * 60 * 60 * 24));
    const rcLabel = `Q${curQ} ${curYear}`;
    const rcDL = `16/${rcDeadlineMonth}/${rcDeadlineYear}`;
    if (rcF > 0) {
      if (rcP) list.push({ type: "ok",   text: `RC-IVA ${rcLabel}: PAGADO ✓ — ${fmt(rcP.real_paid, cur)}` });
      else if (rcPast) list.push({ type: "error", text: `RC-IVA ${rcLabel} VENCIDO — debía pagarse el ${rcDL}` });
      else if (rcDays <= 15) list.push({ type: "warn", text: `RC-IVA ${rcLabel} previsto: ${fmt(rcF, cur)} — vence ${rcDL} (${rcDays} días)` });
    }

    // ── Utilidad y meta
    if ((mesActual.ganancia || 0) < 0) list.push({ type: "error", text: `Este mes hay pérdida de ${fmt(Math.abs(mesActual.ganancia || 0), cur)}` });
    else if ((mesActual.ganancia || 0) > 0) list.push({ type: "ok", text: `Utilidad de ${MONTHS_ES[curMonth - 1]}: ${fmt(mesActual.ganancia || 0, cur)}` });

    if (pctMeta >= 100) list.push({ type: "ok",  text: `¡Meta anual alcanzada! ${pctMeta}% completado` });
    else if (pctMeta > 0) list.push({ type: "info", text: `Meta anual: ${pctMeta}% completado (${fmt(gananciaAnual, cur)} de ${fmt(goal, cur)})` });

    return list;
  }, [curMonth, curYear, mesActual, pctMeta]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Monitor Maestro</h1>
          <p className="page-subtitle">Vista general del estado financiero del proyecto</p>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid-4" style={{ gap: 14, marginBottom: mesActual.retencionIngresos > 0 ? 10 : 20 }}>
        <KpiCard icon="💰" label="Ingresos Brutos del Mes" value={fmt(mesActual.ingresosBrutos || 0, cur)} color="var(--accent-green)" sub={`${MONTHS_ES[curMonth - 1]} ${curYear}`} />
        <KpiCard icon="💸" label="Gastos + Costos" value={fmt((mesActual.gastosTotales || 0) + (mesActual.costosTotales || 0), cur)} color="var(--accent-red)" sub="Mes actual" />
        <KpiCard icon="📈" label="Utilidad Operativa" value={fmt(mesActual.ganancia || 0, cur)}
          color={(mesActual.ganancia || 0) >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
          sub={(mesActual.retencionIngresos || 0) > 0
            ? `Neta c/imp: ${fmt(mesActual.gananciaNeta || 0, cur)}`
            : (mesActual.ganancia || 0) >= 0 ? "Positiva ✓" : "Negativa ✗"} />
        <KpiCard icon="🎯" label="Meta Anual" value={`${pctMeta}%`} color={pctMeta >= 100 ? "var(--accent-green)" : pctMeta >= 60 ? "#4f8ef7" : "var(--accent-red)"} sub={goal > 0 ? `${fmt(gananciaAnual, cur)} de ${fmt(goal, cur)}` : "Sin meta definida"} />
      </div>

      {/* ── Casilla de retención ── */}
      {(mesActual.retencionIngresos || 0) > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: "9px 16px", background: "rgba(249,200,70,0.10)", border: "1px solid rgba(249,200,70,0.35)", borderRadius: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14 }}>🧾</span>
          <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>Retención de impuestos sobre ingresos:</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#a87c0a" }}>{fmt(mesActual.retencionIngresos, cur)}</span>
          <span style={{ fontSize: 11, color: "var(--text3)" }}>→ Ingresos netos: <strong style={{ color: "var(--accent-green)" }}>{fmt(mesActual.ingresosNetos || 0, cur)}</strong></span>
        </div>
      )}

      {/* ── Gráfico de Barras + Alertas ── */}
      <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>📊 Ingresos vs Gastos — Últimos 6 meses</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last6} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
              <Tooltip content={<CustomTooltip currency={cur} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ingresos" fill="#2dd4a0" radius={[3,3,0,0]} />
              <Bar dataKey="Gastos" fill="#f7566a" radius={[3,3,0,0]} />
              <Bar dataKey="Costos" fill="#f9c846" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>🔔 Alertas y Estado</div>
          {alertas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: 13 }}>Sin alertas activas ✓</div>
          ) : alertas.map((a, i) => <Alert key={i} type={a.type} text={a.text} />)}
        </div>
      </div>

      {/* ── Flujo Acumulado + Distribución Ingresos ── */}
      <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>🌊 Flujo Acumulado — Últimos 6 meses</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={flujoData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
              <Tooltip content={<CustomTooltip currency={cur} />} />
              <Area type="monotone" dataKey="Acumulado" stroke="#4f8ef7" strokeWidth={2} fill="url(#gradAcum)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>🥧 Distribución de Ingresos por Categoría</div>
          {pieData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: 13 }}>Sin datos de ingresos aún</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v, cur)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS_PIE[i % COLORS_PIE.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{fmt(d.value, cur)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Meta Anual Gauge + Resumen Anual ── */}
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 6 }}>🎯 Progreso Meta Anual</div>
          <div style={{ textAlign: "center" }}>
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0} data={[{ value: 100, fill: "var(--bg3)" }, ...gaugeData]}>
                <RadialBar dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: -40, fontSize: 32, fontWeight: 800, color: gaugeData[0].fill }}>{pctMeta}%</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
              {goal > 0 ? `${fmt(gananciaAnual, cur)} de ${fmt(goal, cur)}` : "Define tu meta en Configuración"}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>📋 Resumen del Año</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Total Ingresos Brutos", val: ingresos.reduce((s,x) => s+(x.ingresoTotal||0),0), color: "var(--accent-green)" },
              { label: "Total Retención Imp.",  val: ingresos.reduce((s,x) => s+(x.valorImpuesto||0),0), color: "#a87c0a" },
              { label: "Total Gastos",          val: gastos.reduce((s,x) => s+(x.totalNeto||0),0), color: "var(--accent-red)" },
              { label: "Total Costos",          val: costos.reduce((s,x) => s+(x.totalNeto||0),0), color: "var(--accent-yellow)" },
              { label: "Utilidad Neta",         val: ingresos.reduce((s,x)=>s+(x.totalNeto||0),0) - gastos.reduce((s,x)=>s+(x.totalNeto||0),0) - costos.reduce((s,x)=>s+(x.totalNeto||0),0), color: "var(--accent)" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--bg3)", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text2)" }}>{row.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{fmt(row.val, cur)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
