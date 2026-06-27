import { useState } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getQuarter(month) { return Math.ceil(month / 3); }

function quarterLabel(q, year) {
  const ranges = { 1: "Ene–Feb–Mar", 2: "Abr–May–Jun", 3: "Jul–Ago–Sep", 4: "Oct–Nov–Dic" };
  return `${ranges[q]} ${year}`;
}

// Mes en que se PAGA el impuesto de un período mensual (M+1, día 16)
function paymentMonthOf(incomeMonth, incomeYear) {
  const m = incomeMonth === 12 ? 1 : incomeMonth + 1;
  const y = incomeMonth === 12 ? incomeYear + 1 : incomeYear;
  return { month: m, year: y, label: `${MONTHS_ES[m - 1]} ${y}`, deadline: new Date(y, m - 1, 16) };
}

// Mes en que se PAGA el RC-IVA de un trimestre (primer mes del siguiente trimestre, día 16)
function rcIvaPaymentInfo(quarter, year) {
  const map = {
    1: { month: 4, year, label: `16 Abr ${year}` },
    2: { month: 7, year, label: `16 Jul ${year}` },
    3: { month: 10, year, label: `16 Oct ${year}` },
    4: { month: 1, year: year + 1, label: `16 Ene ${year + 1}` },
  };
  const info = map[quarter];
  return { ...info, deadline: new Date(info.year, info.month - 1, 16) };
}

// Estado de un pago basado en vencimiento
function taxStatus(deadline, hasPayment) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (hasPayment) return { label: "PAGADO", color: "#0d9e72", bg: "rgba(45,212,160,0.10)", border: "rgba(45,212,160,0.3)", icon: "✅" };
  const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: "VENCIDO", color: "#d63348", bg: "rgba(247,86,106,0.10)", border: "rgba(247,86,106,0.3)", icon: "🔴" };
  if (daysLeft <= 10) return { label: `VENCE EN ${daysLeft} DÍAS`, color: "#a87c0a", bg: "rgba(249,200,70,0.12)", border: "rgba(249,200,70,0.35)", icon: "⚠️" };
  return { label: "PENDIENTE", color: "var(--text3)", bg: "var(--bg3)", border: "var(--border)", icon: "🕐" };
}

// ─── Datos históricos para importación masiva ──────────────────
// Datos extraídos directamente del archivo Excel "iva it.xlsx"
const HISTORICO_IVA_IT = [
  { period:"2024-10", ivaReal:32136,        itReal:7575 },
  { period:"2024-11", ivaReal:32352,        itReal:7625 },
  { period:"2024-12", ivaReal:40776,        itReal:9570 },
  { period:"2025-01", ivaReal:36580,        itReal:8663 },
  { period:"2025-02", ivaReal:38285,        itReal:8993 },
  { period:"2025-03", ivaReal:38285,        itReal:8993 },
  { period:"2025-04", ivaReal:34821,        itReal:8178 },
  { period:"2025-05", ivaReal:37489.26,     itReal:8795.46 },
  { period:"2025-06", ivaReal:36183.8,      itReal:8493 },
  { period:"2025-07", ivaReal:32792.07,     itReal:7612 },
  { period:"2025-08", ivaReal:36474.88,     itReal:8570.09 },
  { period:"2025-09", ivaReal:29688.34,     itReal:7000 },
  { period:"2025-10", ivaReal:35642.55,     itReal:8369.75 },
  { period:"2025-11", ivaReal:27809.5,      itReal:6332.46 },
  { period:"2025-12", ivaReal:23167.39,     itReal:5410.23 },
  { period:"2026-01", ivaReal:27274.21,     itReal:6423.23 },
  { period:"2026-02", ivaReal:24587.54,     itReal:5787.61 },
  { period:"2026-03", ivaReal:19731.17,     itReal:5223.77 },
  { period:"2026-04", ivaReal:38447.27,     itReal:9411.45 },
  { period:"2026-05", ivaReal:33627.55,     itReal:8923.15 },
];

export default function Impuestos() {
  const { config, periods, getTaxForecast, getQuarterTaxForecast, getTaxPayment, saveTaxPayment, isReadOnly } = useApp();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [showImport,   setShowImport]     = useState(false);
  const [importing,    setImporting]      = useState(false);
  const [importDone,   setImportDone]     = useState(false);

  const monthKey   = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const quarter    = getQuarter(selectedMonth);
  const quarterKey = `${selectedYear}-Q${quarter}`;

  const ivaForecast          = getTaxForecast("iva",   selectedMonth, selectedYear);
  const itForecast           = getTaxForecast("it",    selectedMonth, selectedYear);
  const rcivaQuarterForecast = getQuarterTaxForecast("rciva", quarterKey);

  const ivaPayment   = getTaxPayment("iva",   monthKey);
  const itPayment    = getTaxPayment("it",    monthKey);
  const rcivaPayment = getTaxPayment("rciva", quarterKey);

  const ivaPayInfo   = paymentMonthOf(selectedMonth, selectedYear);
  const itPayInfo    = paymentMonthOf(selectedMonth, selectedYear);
  const rcPayInfo    = rcIvaPaymentInfo(quarter, selectedYear);

  const ivaStatus    = taxStatus(ivaPayInfo.deadline,  !!ivaPayment);
  const itStatus     = taxStatus(itPayInfo.deadline,   !!itPayment);
  const rcStatus     = taxStatus(rcPayInfo.deadline,   !!rcivaPayment);

  // Detectar qué períodos ya están cargados
  const yaExisten = HISTORICO_IVA_IT.filter(h => getTaxPayment("iva", h.period));
  const pendientes = HISTORICO_IVA_IT.filter(h => !getTaxPayment("iva", h.period));

  const handleImportarHistorico = async (forzar = false) => {
    setImporting(true);
    for (const h of HISTORICO_IVA_IT) {
      const [y, m] = h.period.split("-").map(Number);
      const pm = m === 12 ? 1 : m + 1;
      const py = m === 12 ? y + 1 : y;
      const fechaPago = `${py}-${String(pm).padStart(2,"0")}-16`;
      if (forzar || !getTaxPayment("iva", h.period))
        await saveTaxPayment("iva", h.period, h.ivaReal, fechaPago, "Histórico Excel iva it.xlsx");
      if (forzar || !getTaxPayment("it", h.period))
        await saveTaxPayment("it",  h.period, h.itReal,  fechaPago, "Histórico Excel iva it.xlsx");
    }
    setImporting(false);
    setImportDone(true);
    setShowImport(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧾 Previsión de Impuestos</h1>
          <p className="page-subtitle">
            IVA (13%) e IT (3%) — se pagan el <strong>16 del mes siguiente</strong> al período &nbsp;·&nbsp;
            RC-IVA (12.5%) — se paga el <strong>16 del mes siguiente al trimestre</strong>
          </p>
        </div>
        {!isReadOnly && (
          <div style={{ display:"flex", gap:8 }}>
            {importDone && <span style={{ fontSize:12, color:"var(--accent-green)", fontWeight:700, alignSelf:"center" }}>✅ Histórico importado</span>}
            <button className="btn btn-ghost" onClick={() => setShowImport(true)}>
              📥 Cargar histórico IVA/IT
            </button>
          </div>
        )}
      </div>

      {/* ── Modal de importación histórica ── */}
      {showImport && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowImport(false)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h2 className="modal-title">📥 Importar Histórico IVA/IT</h2>
              <button className="modal-close" onClick={() => setShowImport(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom:14, padding:"10px 14px", background:"rgba(79,142,247,0.08)", borderRadius:8, fontSize:12, color:"var(--text2)" }}>
                Se cargarán <strong>{pendientes.length} períodos</strong> (Oct 2024 → May 2026) con IVA real e IT real.
                {yaExisten.length > 0 && <span style={{ color:"var(--accent-green)" }}> {yaExisten.length} ya estaban cargados y se omitirán.</span>}
              </div>
              <div style={{ maxHeight:380, overflowY:"auto" }}>
                <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"var(--bg3)", position:"sticky", top:0 }}>
                      <th style={{ padding:"7px 10px", textAlign:"left", fontWeight:600, color:"var(--text3)" }}>Período</th>
                      <th style={{ padding:"7px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>IVA Real Pagado</th>
                      <th style={{ padding:"7px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>IT Real Pagado</th>
                      <th style={{ padding:"7px 10px", textAlign:"center", fontWeight:600, color:"var(--text3)" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HISTORICO_IVA_IT.map((h, i) => {
                      const [y, m] = h.period.split("-").map(Number);
                      const label = `${MONTHS_ES[m-1]} ${y}`;
                      const yaExiste = !!getTaxPayment("iva", h.period);
                      return (
                        <tr key={h.period} style={{ borderTop:"1px solid var(--border)", background: yaExiste ? "rgba(45,212,160,0.05)" : i%2===0?"transparent":"var(--bg3)" }}>
                          <td style={{ padding:"6px 10px", fontWeight:600, color:"var(--text)" }}>{label}</td>
                          <td style={{ padding:"6px 10px", textAlign:"right", color:"#4f8ef7", fontVariantNumeric:"tabular-nums" }}>
                            {h.ivaReal.toLocaleString("es-BO", { minimumFractionDigits:2 })}
                          </td>
                          <td style={{ padding:"6px 10px", textAlign:"right", color:"#a78bfa", fontVariantNumeric:"tabular-nums" }}>
                            {h.itReal.toLocaleString("es-BO", { minimumFractionDigits:2 })}
                          </td>
                          <td style={{ padding:"6px 10px", textAlign:"center" }}>
                            {yaExiste
                              ? <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(45,212,160,0.12)", color:"var(--accent-green)", fontWeight:700 }}>✅ Ya existe</span>
                              : <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(79,142,247,0.12)", color:"#4f8ef7", fontWeight:700 }}>📥 Pendiente</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"var(--bg2)", fontWeight:700, borderTop:"2px solid var(--border)" }}>
                      <td style={{ padding:"8px 10px" }}>TOTAL ({HISTORICO_IVA_IT.length} meses)</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#4f8ef7" }}>
                        {HISTORICO_IVA_IT.reduce((s,h)=>s+h.ivaReal,0).toLocaleString("es-BO",{minimumFractionDigits:2})}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#a78bfa" }}>
                        {HISTORICO_IVA_IT.reduce((s,h)=>s+h.itReal,0).toLocaleString("es-BO",{minimumFractionDigits:2})}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent:"space-between" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => handleImportarHistorico(true)}
                disabled={importing}
                style={{ fontSize:11, color:"var(--accent-red)", borderColor:"var(--accent-red)" }}>
                {importing ? "⏳..." : "🔄 Reimportar (sobreescribir todo)"}
              </button>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-ghost" onClick={() => setShowImport(false)}>Cancelar</button>
                <button className="btn btn-primary" disabled={importing || pendientes.length===0} onClick={() => handleImportarHistorico(false)}
                  style={{ opacity: pendientes.length===0 ? 0.5 : 1 }}>
                  {importing ? "⏳ Importando..." : pendientes.length===0 ? "✅ Todo ya importado" : `📥 Importar ${pendientes.length} períodos`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selector de período */}
      <div className="form-row" style={{ maxWidth: 420, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Mes del ingreso (período)</label>
          <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)}>
            {MONTHS_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Año</label>
          <input className="form-input" type="number" value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} />
        </div>
      </div>

      {/* Línea de tiempo de pago */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24, background: "var(--bg2)", borderRadius: 12, padding: "14px 20px", border: "1px solid var(--border)" }}>
        <TimelineStep label={`Ingresos de\n${MONTHS_ES[selectedMonth - 1]} ${selectedYear}`} active={true} color="#4f8ef7" />
        <TimelineArrow label="genera impuesto" />
        <TimelineStep label={`Cálculo:\nIVA + IT + RC-IVA`} active={true} color="#a87c0a" />
        <TimelineArrow label="se paga el 16 del mes siguiente" />
        <TimelineStep label={`Pago IVA/IT:\n16 de ${ivaPayInfo.label}`} active={!!ivaPayment} color={ivaStatus.color} />
        <TimelineArrow label="RC-IVA trimestral" />
        <TimelineStep label={`Pago RC-IVA:\n${rcPayInfo.label}`} active={!!rcivaPayment} color={rcStatus.color} />
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        <TaxCard
          icon="💵" title="IVA Mensual" rate="13%"
          forecast={ivaForecast} payment={ivaPayment}
          periodLabel={`${MONTHS_ES[selectedMonth - 1]} ${selectedYear}`}
          payInfo={ivaPayInfo} status={ivaStatus}
          currency={config.currency}
          onSave={(real, date, notes) => saveTaxPayment("iva", monthKey, real, date, notes)}
          isReadOnly={isReadOnly}
          note="Se puede compensar hasta 30% con Compra de Facturas"
        />
        <TaxCard
          icon="📋" title="IT Mensual" rate="3%"
          forecast={itForecast} payment={itPayment}
          periodLabel={`${MONTHS_ES[selectedMonth - 1]} ${selectedYear}`}
          payInfo={itPayInfo} status={itStatus}
          currency={config.currency}
          onSave={(real, date, notes) => saveTaxPayment("it", monthKey, real, date, notes)}
          isReadOnly={isReadOnly}
          note="No se compensa — siempre se paga el monto completo"
        />
      </div>

      <RcIvaCard
        forecast={rcivaQuarterForecast} payment={rcivaPayment}
        quarter={quarter} year={selectedYear}
        quarterKey={quarterKey} payInfo={rcPayInfo} status={rcStatus}
        currency={config.currency}
        onSave={(real, date, notes) => saveTaxPayment("rciva", quarterKey, real, date, notes)}
        isReadOnly={isReadOnly}
        getTaxForecast={getTaxForecast}
      />

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Resumen Anual — Previsto vs Pagado vs Vencimiento</div>
        <AnnualTaxTable periods={periods} getTaxForecast={getTaxForecast} getTaxPayment={getTaxPayment} currency={config.currency} />
      </div>
    </div>
  );
}

// ─── Timeline ──────────────────────────────────────────────────
function TimelineStep({ label, active, color }) {
  return (
    <div style={{ textAlign: "center", minWidth: 90 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: active ? color : "var(--bg3)", border: `2px solid ${color}`, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--text2)", lineHeight: 1.4, whiteSpace: "pre-line", fontWeight: active ? 700 : 400 }}>{label}</div>
    </div>
  );
}
function TimelineArrow({ label }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ height: 2, background: "var(--border)", position: "relative", margin: "15px 0 8px" }}>
        <span style={{ position: "absolute", right: -4, top: -5, color: "var(--text3)" }}>▶</span>
      </div>
      <div style={{ fontSize: 9, color: "var(--text3)", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

// ─── TaxCard ───────────────────────────────────────────────────
function TaxCard({ icon, title, rate, forecast, payment, periodLabel, payInfo, status, currency, onSave, isReadOnly, note }) {
  const [editing, setEditing] = useState(false);
  const [realPaid, setRealPaid] = useState(payment?.real_paid || 0);
  const [paidDate, setPaidDate] = useState(payment?.paid_date || payInfo.deadline.toISOString().split("T")[0]);

  const real = payment?.real_paid || 0;
  const diff = real - forecast;

  const handleSave = () => { onSave(realPaid, paidDate, ""); setEditing(false); };

  return (
    <div className="card" style={{ borderTop: `3px solid ${status.color}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{title}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>Período: {periodLabel}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>📅 Vence el <strong>16 de {payInfo.label}</strong></div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="badge badge-blue">{rate}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
            {status.icon} {status.label}
          </span>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Previsto</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{fmt(forecast, currency)}</div>
        </div>
        <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Real Pagado</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: payment ? "var(--accent-green)" : "var(--text3)" }}>
            {payment ? fmt(real, currency) : "— Sin registrar"}
          </div>
          {payment?.paid_date && (
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Pagado el {fmtDate(payment.paid_date)}</div>
          )}
        </div>
      </div>

      {payment && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, marginBottom: 14, background: diff <= 0 ? "rgba(31,184,127,0.1)" : "rgba(239,64,96,0.1)" }}>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>{diff <= 0 ? "✅ Compensado / a favor" : "⚠️ Diferencia"}</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: diff <= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{fmt(Math.abs(diff), currency)}</span>
        </div>
      )}

      {note && <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14, fontStyle: "italic" }}>{note}</p>}

      {!isReadOnly && !editing && (
        <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setEditing(true)}>
          {payment ? "✏️ Editar pago real" : `+ Registrar pago (vence 16/${payInfo.label})`}
        </button>
      )}
      {editing && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
          <div className="form-row" style={{ marginBottom: 10 }}>
            <div className="form-group">
              <label className="form-label">Monto Real Pagado</label>
              <input className="form-input" type="number" step="0.01" value={realPaid} onChange={e => setRealPaid(+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Pago (esperado: 16/{payInfo.label})</label>
              <input className="form-input" type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RC-IVA Card ───────────────────────────────────────────────
function RcIvaCard({ forecast, payment, quarter, year, quarterKey, payInfo, status, currency, onSave, isReadOnly, getTaxForecast }) {
  const [editing, setEditing] = useState(false);
  const [realPaid, setRealPaid] = useState(payment?.real_paid || 0);
  const [paidDate, setPaidDate] = useState(payment?.paid_date || payInfo.deadline.toISOString().split("T")[0]);

  const real = payment?.real_paid || 0;
  const diff = forecast - real;
  const months = [(quarter-1)*3 + 1, (quarter-1)*3 + 2, (quarter-1)*3 + 3];
  const monthlyBreakdown = months.map(m => ({ month: m, label: MONTHS_ES[m-1], forecast: getTaxForecast("rciva", m, year) }));

  const handleSave = () => { onSave(realPaid, paidDate, ""); setEditing(false); };

  return (
    <div className="card" style={{ borderColor: status.color, borderWidth: 2 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📦</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>RC-IVA Trimestral</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>Período: {quarterLabel(quarter, year)}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>📅 Vence el <strong>{payInfo.label}</strong></div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="badge" style={{ background: "rgba(157,109,240,0.15)", color: "var(--accent-purple)", border: "1px solid rgba(157,109,240,0.3)" }}>12.5%</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
            {status.icon} {status.label}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {monthlyBreakdown.map(m => (
          <div key={m.month} style={{ flex: 1, background: "var(--bg3)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{fmt(m.forecast, currency)}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <div style={{ background: "rgba(157,109,240,0.08)", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Previsto (3 meses)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{fmt(forecast, currency)}</div>
        </div>
        <div style={{ background: "rgba(157,109,240,0.08)", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Real Pagado</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: payment ? "var(--accent-green)" : "var(--text3)" }}>
            {payment ? fmt(real, currency) : "— Sin registrar"}
          </div>
          {payment?.paid_date && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Pagado el {fmtDate(payment.paid_date)}</div>}
        </div>
      </div>

      {payment && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, marginBottom: 14, background: diff >= 0 ? "rgba(31,184,127,0.1)" : "rgba(239,64,96,0.1)" }}>
          <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>{diff >= 0 ? "💚 A favor / compensado" : "⚠️ Pagaste de más"}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: diff >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{fmt(Math.abs(diff), currency)}</span>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14, fontStyle: "italic" }}>
        💡 El monto real lo proporciona el contador tras calcular la compensación con facturas de compra.
      </p>

      {!isReadOnly && !editing && (
        <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setEditing(true)}>
          {payment ? "✏️ Editar pago real" : `+ Registrar pago (vence ${payInfo.label})`}
        </button>
      )}
      {editing && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
          <div className="form-row" style={{ marginBottom: 10 }}>
            <div className="form-group">
              <label className="form-label">Monto Real Pagado (informado por contador)</label>
              <input className="form-input" type="number" step="0.01" value={realPaid} onChange={e => setRealPaid(+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Pago (esperado: {payInfo.label})</label>
              <input className="form-input" type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabla Anual ───────────────────────────────────────────────
function AnnualTaxTable({ periods, getTaxForecast, getTaxPayment, currency }) {
  const today = new Date(); today.setHours(0,0,0,0);

  const rows = periods.map(p => {
    const monthKey = `${p.year}-${String(p.month).padStart(2, "0")}`;
    const ivaForecast = getTaxForecast("iva", p.month, p.year);
    const itForecast  = getTaxForecast("it",  p.month, p.year);
    const ivaPay = getTaxPayment("iva", monthKey);
    const itPay  = getTaxPayment("it",  monthKey);
    const payInfo = paymentMonthOf(p.month, p.year);
    const ivaStatus = taxStatus(payInfo.deadline, !!ivaPay);
    const itStatus  = taxStatus(payInfo.deadline, !!itPay);
    return { ...p, ivaForecast, itForecast, ivaPay, itPay, payInfo, ivaStatus, itStatus };
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Período (Ingreso)</th>
            <th style={{ textAlign: "center" }}>Fecha Límite Pago</th>
            <th style={{ textAlign: "right" }}>IVA Previsto</th>
            <th style={{ textAlign: "right" }}>IVA Real</th>
            <th style={{ textAlign: "center" }}>Estado IVA</th>
            <th style={{ textAlign: "right" }}>IT Previsto</th>
            <th style={{ textAlign: "right" }}>IT Real</th>
            <th style={{ textAlign: "center" }}>Estado IT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td style={{ fontWeight: 500, color: "var(--text)" }}>{r.label}</td>
              <td style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>16 de {r.payInfo.label}</td>
              <td className="num-col">{fmt(r.ivaForecast, currency)}</td>
              <td className="num-col" style={{ color: r.ivaPay ? "var(--accent-green)" : "var(--text3)" }}>
                {r.ivaPay ? fmt(r.ivaPay.real_paid, currency) : "—"}
              </td>
              <td style={{ textAlign: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: r.ivaStatus.bg, color: r.ivaStatus.color, border: `1px solid ${r.ivaStatus.border}`, whiteSpace: "nowrap" }}>
                  {r.ivaStatus.icon} {r.ivaStatus.label}
                </span>
              </td>
              <td className="num-col">{fmt(r.itForecast, currency)}</td>
              <td className="num-col" style={{ color: r.itPay ? "var(--accent-green)" : "var(--text3)" }}>
                {r.itPay ? fmt(r.itPay.real_paid, currency) : "—"}
              </td>
              <td style={{ textAlign: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: r.itStatus.bg, color: r.itStatus.color, border: `1px solid ${r.itStatus.border}`, whiteSpace: "nowrap" }}>
                  {r.itStatus.icon} {r.itStatus.label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
