import { useState } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getQuarter(month) {
  return Math.ceil(month / 3);
}

function quarterLabel(q, year) {
  const ranges = { 1: "Ene-Feb-Mar", 2: "Abr-May-Jun", 3: "Jul-Ago-Sep", 4: "Oct-Nov-Dic" };
  return `${ranges[q]} ${year}`;
}

function quarterPaymentMonth(q, year) {
  // Q1 (Ene-Mar) se paga en Abril, Q2 (Abr-Jun) en Julio, Q3 (Jul-Sep) en Octubre, Q4 (Oct-Dic) en Enero siguiente
  const map = { 1: { m: "Abril", y: year }, 2: { m: "Julio", y: year }, 3: { m: "Octubre", y: year }, 4: { m: "Enero", y: year + 1 } };
  return map[q];
}

export default function Impuestos() {
  const { config, periods, getTaxForecast, getQuarterTaxForecast, getTaxPayment, saveTaxPayment, isReadOnly } = useApp();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const quarter = getQuarter(selectedMonth);
  const quarterKey = `${selectedYear}-Q${quarter}`;

  const ivaForecast = getTaxForecast("iva", selectedMonth, selectedYear);
  const itForecast = getTaxForecast("it", selectedMonth, selectedYear);
  const rcivaQuarterForecast = getQuarterTaxForecast("rciva", quarterKey);

  const ivaPayment = getTaxPayment("iva", monthKey);
  const itPayment = getTaxPayment("it", monthKey);
  const rcivaPayment = getTaxPayment("rciva", quarterKey);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧾 Previsión de Impuestos</h1>
          <p className="page-subtitle">IVA (13%) e IT (3%) mensual · RC-IVA (12.5%) trimestral — calculados sobre ingreso bruto</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="form-row" style={{ maxWidth: 400, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Mes</label>
          <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)}>
            {MONTHS_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Año</label>
          <input className="form-input" type="number" value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} />
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        <TaxCard
          icon="💵" title="IVA Mensual" rate="13%"
          forecast={ivaForecast}
          payment={ivaPayment}
          periodLabel={`${MONTHS_ES[selectedMonth - 1]} ${selectedYear}`}
          currency={config.currency}
          onSave={(real, date, notes) => saveTaxPayment("iva", monthKey, real, date, notes)}
          isReadOnly={isReadOnly}
          note="Se puede compensar hasta 30% con Compra de Facturas"
        />

        <TaxCard
          icon="📋" title="IT Mensual" rate="3%"
          forecast={itForecast}
          payment={itPayment}
          periodLabel={`${MONTHS_ES[selectedMonth - 1]} ${selectedYear}`}
          currency={config.currency}
          onSave={(real, date, notes) => saveTaxPayment("it", monthKey, real, date, notes)}
          isReadOnly={isReadOnly}
          note="No se compensa — siempre se paga el monto completo"
        />
      </div>

      {/* RC-IVA Quarterly Card - full width */}
      <RcIvaCard
        forecast={rcivaQuarterForecast}
        payment={rcivaPayment}
        quarter={quarter}
        year={selectedYear}
        quarterKey={quarterKey}
        currency={config.currency}
        onSave={(real, date, notes) => saveTaxPayment("rciva", quarterKey, real, date, notes)}
        isReadOnly={isReadOnly}
        getTaxForecast={getTaxForecast}
      />

      {/* Annual summary table */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Resumen Anual — Previsto vs Pagado</div>
        <AnnualTaxTable periods={periods} getTaxForecast={getTaxForecast} getTaxPayment={getTaxPayment} currency={config.currency} />
      </div>
    </div>
  );
}

function TaxCard({ icon, title, rate, forecast, payment, periodLabel, currency, onSave, isReadOnly, note }) {
  const [editing, setEditing] = useState(false);
  const [realPaid, setRealPaid] = useState(payment?.real_paid || 0);
  const [paidDate, setPaidDate] = useState(payment?.paid_date || new Date().toISOString().split("T")[0]);

  const real = payment?.real_paid || 0;
  const diff = real - forecast;
  const hasPayment = payment != null;

  const handleSave = () => {
    onSave(realPaid, paidDate, "");
    setEditing(false);
  };

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{title}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{periodLabel}</div>
          </div>
        </div>
        <span className="badge badge-blue">{rate}</span>
      </div>

      <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
        <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Previsto</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{fmt(forecast, currency)}</div>
        </div>
        <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Real Pagado</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: hasPayment ? "var(--accent-green)" : "var(--text3)" }}>
            {hasPayment ? fmt(real, currency) : "— Sin registrar"}
          </div>
        </div>
      </div>

      {hasPayment && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", borderRadius: 8, marginBottom: 14,
          background: diff <= 0 ? "rgba(31,184,127,0.1)" : "rgba(239,64,96,0.1)",
        }}>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>
            {diff <= 0 ? "✅ Compensado / a favor" : "⚠️ Diferencia"}
          </span>
          <span style={{ fontWeight: 700, fontSize: 13, color: diff <= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
            {fmt(Math.abs(diff), currency)}
          </span>
        </div>
      )}

      {note && <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14, fontStyle: "italic" }}>{note}</p>}

      {!isReadOnly && !editing && (
        <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setEditing(true)}>
          {hasPayment ? "✏️ Editar pago real" : "+ Registrar pago real"}
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
              <label className="form-label">Fecha de Pago</label>
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

function RcIvaCard({ forecast, payment, quarter, year, quarterKey, currency, onSave, isReadOnly, getTaxForecast }) {
  const [editing, setEditing] = useState(false);
  const [realPaid, setRealPaid] = useState(payment?.real_paid || 0);
  const [paidDate, setPaidDate] = useState(payment?.paid_date || new Date().toISOString().split("T")[0]);

  const real = payment?.real_paid || 0;
  const diff = forecast - real; // "a favor" if real < forecast (compensated)
  const hasPayment = payment != null;
  const payInfo = quarterPaymentMonth(quarter, year);

  const months = [(quarter-1)*3 + 1, (quarter-1)*3 + 2, (quarter-1)*3 + 3];
  const monthlyBreakdown = months.map(m => ({ month: m, label: MONTHS_ES[m-1], forecast: getTaxForecast("rciva", m, year) }));

  const handleSave = () => {
    onSave(realPaid, paidDate, "");
    setEditing(false);
  };

  return (
    <div className="card" style={{ borderColor: "var(--accent-purple)", borderWidth: 2 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📦</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>RC-IVA Trimestral</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>{quarterLabel(quarter, year)} — se paga en {payInfo.m} {payInfo.y}</div>
          </div>
        </div>
        <span className="badge" style={{ background: "rgba(157,109,240,0.15)", color: "var(--accent-purple)", border: "1px solid rgba(157,109,240,0.3)" }}>12.5%</span>
      </div>

      {/* Monthly breakdown of the quarter */}
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
          <div style={{ fontSize: 20, fontWeight: 700, color: hasPayment ? "var(--accent-green)" : "var(--text3)" }}>
            {hasPayment ? fmt(real, currency) : "— Sin registrar"}
          </div>
        </div>
      </div>

      {hasPayment && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", borderRadius: 8, marginBottom: 14,
          background: diff >= 0 ? "rgba(31,184,127,0.1)" : "rgba(239,64,96,0.1)",
        }}>
          <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>
            {diff >= 0 ? "💚 A favor / compensado" : "⚠️ Pagaste de más"}
          </span>
          <span style={{ fontWeight: 700, fontSize: 15, color: diff >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
            {fmt(Math.abs(diff), currency)}
          </span>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14, fontStyle: "italic" }}>
        💡 El monto real lo proporciona el contador tras calcular la compensación con facturas de compra. Se retiene 12.5% cada mes pero se paga junto cada 3 meses.
      </p>

      {!isReadOnly && !editing && (
        <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setEditing(true)}>
          {hasPayment ? "✏️ Editar pago real" : "+ Registrar pago real del trimestre"}
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
              <label className="form-label">Fecha de Pago</label>
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

function AnnualTaxTable({ periods, getTaxForecast, getTaxPayment, currency }) {
  const rows = periods.map(p => {
    const monthKey = `${p.year}-${String(p.month).padStart(2, "0")}`;
    const ivaForecast = getTaxForecast("iva", p.month, p.year);
    const itForecast = getTaxForecast("it", p.month, p.year);
    const ivaPay = getTaxPayment("iva", monthKey);
    const itPay = getTaxPayment("it", monthKey);
    return {
      ...p,
      ivaForecast, itForecast,
      ivaReal: ivaPay?.real_paid ?? null,
      itReal: itPay?.real_paid ?? null,
    };
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th style={{ textAlign: "right" }}>IVA Previsto</th>
            <th style={{ textAlign: "right" }}>IVA Real</th>
            <th style={{ textAlign: "right" }}>IT Previsto</th>
            <th style={{ textAlign: "right" }}>IT Real</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td style={{ fontWeight: 500, color: "var(--text)" }}>{r.label}</td>
              <td className="num-col">{fmt(r.ivaForecast, currency)}</td>
              <td className="num-col" style={{ color: r.ivaReal != null ? "var(--accent-green)" : "var(--text3)" }}>
                {r.ivaReal != null ? fmt(r.ivaReal, currency) : "—"}
              </td>
              <td className="num-col">{fmt(r.itForecast, currency)}</td>
              <td className="num-col" style={{ color: r.itReal != null ? "var(--accent-green)" : "var(--text3)" }}>
                {r.itReal != null ? fmt(r.itReal, currency) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
