import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const BANKS = [
  "Banco Unión","BNB","Banco Mercantil Santa Cruz","Banco BISA","Banco Económico",
  "Banco de Crédito de Bolivia","Banco FIE","Banco Solidario","Banco PyME Los Andes",
  "Otro",
];
const ACCOUNT_TYPES = ["Cuenta Corriente","Caja de Ahorro","Cuenta Empresarial"];

function downloadCSV(content, filename) {
  const bom = "﻿";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Banco() {
  const { config, setConfig, ingresos, gastos, costos, isReadOnly } = useApp();
  const cb = config.cuentaBancaria || {};
  const [showSetup, setShowSetup] = useState(false);

  if (!cb.activa) {
    return <SetupScreen onSetup={() => setShowSetup(true)} showSetup={showSetup}
      setShowSetup={setShowSetup} config={config} setConfig={setConfig} isReadOnly={isReadOnly} />;
  }

  return <BankDashboard cb={cb} config={config} setConfig={setConfig}
    ingresos={ingresos} gastos={gastos} costos={costos} isReadOnly={isReadOnly} />;
}

// ─── Pantalla de configuración inicial ─────────────────────────
function SetupScreen({ onSetup, showSetup, setShowSetup, config, setConfig, isReadOnly }) {
  const [form, setForm] = useState({
    banco: "", numeroCuenta: "", tipoCuenta: "Cuenta Corriente",
    saldoInicial: 0, fechaSaldoInicial: new Date().toISOString().split("T")[0],
    metodosVinculados: [], activa: true,
  });

  const handleSave = () => {
    if (!form.banco) return alert("Selecciona un banco");
    setConfig(prev => ({ ...prev, cuentaBancaria: { ...form, activa: true } }));
    setShowSetup(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Cuenta Bancaria</h1>
          <p className="page-subtitle">Vincula una cuenta bancaria al proyecto para seguimiento automático</p>
        </div>
      </div>

      {!showSetup ? (
        <div style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🏦</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
            Sin cuenta bancaria configurada
          </h2>
          <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            Vincula una cuenta bancaria para ver tu saldo actualizado automáticamente
            cada vez que registres ingresos, gastos o costos.
          </p>
          {!isReadOnly && (
            <button className="btn btn-primary" style={{ padding: "12px 32px", fontSize: 15 }}
              onClick={() => setShowSetup(true)}>
              + Configurar Cuenta Bancaria
            </button>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="card" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>
              🏦 Datos de la Cuenta
            </h3>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Banco *</label>
                <select className="form-select" value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))}>
                  <option value="">Seleccionar banco...</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Cuenta</label>
                <select className="form-select" value={form.tipoCuenta} onChange={e => setForm(p => ({ ...p, tipoCuenta: e.target.value }))}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Número de Cuenta</label>
                <input className="form-input" placeholder="Ej: 1234-5678" value={form.numeroCuenta}
                  onChange={e => setForm(p => ({ ...p, numeroCuenta: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha del Saldo Inicial</label>
                <input className="form-input" type="date" value={form.fechaSaldoInicial}
                  onChange={e => setForm(p => ({ ...p, fechaSaldoInicial: e.target.value }))} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Saldo Inicial ({config.currency})</label>
              <input className="form-input" type="number" step="0.01" value={form.saldoInicial}
                onChange={e => setForm(p => ({ ...p, saldoInicial: +e.target.value }))} />
              <small style={{ color: "var(--text3)", fontSize: 11, marginTop: 4, display: "block" }}>
                Monto que había en la cuenta en la fecha inicial seleccionada
              </small>
            </div>
            <div className="form-group" style={{ marginBottom: 22 }}>
              <label className="form-label">Métodos de pago que afectan esta cuenta</label>
              <small style={{ color: "var(--text3)", fontSize: 11, display: "block", marginBottom: 8 }}>
                Solo las transacciones con estos métodos moverán el saldo bancario
              </small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(config.metodosPago || []).map(m => {
                  const sel = form.metodosVinculados.includes(m);
                  return (
                    <button key={m} type="button"
                      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: sel ? 700 : 400, background: sel ? "var(--accent)" : "var(--bg3)", color: sel ? "#fff" : "var(--text2)", border: sel ? "1px solid var(--accent)" : "1px solid var(--border)" }}
                      onClick={() => setForm(p => ({ ...p, metodosVinculados: sel ? p.metodosVinculados.filter(x => x !== m) : [...p.metodosVinculados, m] }))}>
                      {sel ? "✓ " : ""}{m}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setShowSetup(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>Guardar y Activar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard bancario principal ──────────────────────────────
function BankDashboard({ cb, config, setConfig, ingresos, gastos, costos, isReadOnly }) {
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ ...cb });
  const cur = config.currency;
  const methods = new Set(cb.metodosVinculados || []);
  const cutoff = cb.fechaSaldoInicial || "2000-01-01";

  // ── Calcular movimientos ─────────────────────────────────────
  const movements = useMemo(() => {
    const all = [
      ...ingresos.filter(x => x.fecha >= cutoff && methods.has(x.metodoPago)).map(x => ({
        id: x.id, fecha: x.fecha, tipo: "ingreso",
        descripcion: x.descripcion || "", categoria: x.categoria,
        monto: x.ingresoTotal || 0,
      })),
      ...gastos.filter(x => x.fecha >= cutoff && methods.has(x.metodoPago)).map(x => ({
        id: x.id, fecha: x.fecha, tipo: "gasto",
        descripcion: x.descripcion || "", categoria: x.categoria,
        monto: -(x.gastoTotal || 0),
      })),
      ...costos.filter(x => x.fecha >= cutoff && methods.has(x.metodoPago)).map(x => ({
        id: x.id, fecha: x.fecha, tipo: "costo",
        descripcion: x.descripcion || "", categoria: x.categoria,
        monto: -(x.costoTotal || 0),
      })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

    let balance = cb.saldoInicial || 0;
    const withBalance = all.map(m => { balance += m.monto; return { ...m, balance }; });
    return withBalance.reverse();
  }, [ingresos, gastos, costos, cb]);

  const currentBalance = movements.length > 0 ? movements[0].balance : (cb.saldoInicial || 0);
  const totalDeposits   = movements.filter(m => m.monto > 0).reduce((s, m) => s + m.monto, 0);
  const totalWithdrawals= movements.filter(m => m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0);

  // ── Chart data: evolución del saldo (por mes) ────────────────
  const chartData = useMemo(() => {
    const byMonth = {};
    const allSorted = [...movements].reverse();
    allSorted.forEach(m => {
      const key = m.fecha.substring(0, 7);
      byMonth[key] = m.balance;
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => ({ mes: k.substring(5), saldo: Math.round(v) }));
  }, [movements]);

  // ── Últimos 5 movimientos por tipo ───────────────────────────
  const [filter, setFilter] = useState("todos");
  const [searchMov, setSearchMov] = useState("");
  const filtered = movements.filter(m => {
    if (filter !== "todos" && m.tipo !== filter) return false;
    if (searchMov && !(m.descripcion.toLowerCase().includes(searchMov.toLowerCase()) || m.categoria.toLowerCase().includes(searchMov.toLowerCase()))) return false;
    return true;
  });

  const handleSaveEdit = () => {
    setConfig(prev => ({ ...prev, cuentaBancaria: { ...editForm } }));
    setEditMode(false);
  };

  const handleDeactivate = () => {
    if (!confirm("¿Desactivar la cuenta bancaria? Los datos no se perderán.")) return;
    setConfig(prev => ({ ...prev, cuentaBancaria: { ...cb, activa: false } }));
  };

  const handleExport = () => {
    const headers = ["Fecha","Tipo","Categoría","Descripción","Movimiento","Saldo"];
    const n = v => v.toFixed(2).replace(".", ",");
    const lines = [headers.join(";"), ...movements.map(m =>
      [m.fecha, m.tipo, m.categoria, `"${m.descripcion.replace(/"/g,'""')}"`, n(m.monto), n(m.balance)].join(";")
    )];
    downloadCSV(lines.join("\n"), `Estado_Cuenta_${cb.banco}_${new Date().toISOString().split("T")[0]}.csv`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Cuenta Bancaria</h1>
          <p className="page-subtitle">Saldo actualizado automáticamente con tus transacciones</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleExport}>📤 Estado de cuenta</button>
          {!isReadOnly && <button className="btn btn-ghost btn-sm" onClick={() => { setEditForm({...cb}); setEditMode(true); }}>⚙️ Editar cuenta</button>}
        </div>
      </div>

      {/* ── Tarjeta bancaria visual ── */}
      <div style={{ marginBottom: 24 }}>
        <BankCard cb={cb} balance={currentBalance} cur={cur} />
      </div>

      {/* ── KPIs ── */}
      <div className="grid-3" style={{ gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: "16px 20px", borderTop: "3px solid var(--accent-green)" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Total Depósitos</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-green)" }}>{fmt(totalDeposits, cur)}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{movements.filter(m => m.monto > 0).length} ingresos vinculados</div>
        </div>
        <div className="card" style={{ padding: "16px 20px", borderTop: "3px solid var(--accent-red)" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Total Retiros</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-red)" }}>{fmt(totalWithdrawals, cur)}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{movements.filter(m => m.monto < 0).length} gastos vinculados</div>
        </div>
        <div className="card" style={{ padding: "16px 20px", borderTop: `3px solid ${currentBalance >= 0 ? "var(--accent-green)" : "var(--accent-red)"}` }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Saldo Actual</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: currentBalance >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{fmt(currentBalance, cur)}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Saldo inicial: {fmt(cb.saldoInicial || 0, cur)}</div>
        </div>
      </div>

      {/* ── Gráfico evolución ── */}
      {chartData.length > 1 && (
        <div className="card" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>📈 Evolución del Saldo</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBank" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
              <Tooltip formatter={(v) => [fmt(v, cur), "Saldo"]} labelStyle={{ color: "var(--text)" }} contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="saldo" stroke="#4f8ef7" strokeWidth={2.5} fill="url(#gradBank)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Movimientos ── */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
            📋 Movimientos ({movements.length})
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["todos","ingreso","gasto","costo"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: filter === f ? 700 : 400, background: filter === f ? "var(--accent)" : "var(--bg3)", color: filter === f ? "#fff" : "var(--text3)", border: `1px solid ${filter === f ? "var(--accent)" : "var(--border)"}` }}>
                {f === "todos" ? "Todos" : f === "ingreso" ? "💰 Ingresos" : f === "gasto" ? "💸 Gastos" : "🏭 Costos"}
              </button>
            ))}
            <input className="form-input" style={{ margin: 0, padding: "4px 12px", fontSize: 11, width: 160 }}
              placeholder="🔍 Buscar..." value={searchMov} onChange={e => setSearchMov(e.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th style={{ textAlign: "right" }}>Movimiento</th>
                <th style={{ textAlign: "right" }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="icon">🏦</div><p>Sin movimientos para los filtros seleccionados</p></div></td></tr>
              ) : filtered.map(m => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(m.fecha)}</td>
                  <td>
                    <span className={`badge badge-${m.tipo === "ingreso" ? "green" : m.tipo === "gasto" ? "red" : "yellow"}`}>
                      {m.tipo === "ingreso" ? "💰" : m.tipo === "gasto" ? "💸" : "🏭"} {m.tipo}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{m.categoria}</td>
                  <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.descripcion}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: m.monto >= 0 ? "var(--accent-green)" : "var(--accent-red)", whiteSpace: "nowrap" }}>
                    {m.monto >= 0 ? "+" : ""}{fmt(m.monto, cur)}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: m.balance >= 0 ? "var(--text)" : "var(--accent-red)", whiteSpace: "nowrap" }}>
                    {fmt(m.balance, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal editar cuenta ── */}
      {editMode && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditMode(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title">⚙️ Editar Cuenta Bancaria</h2>
              <button className="modal-close" onClick={() => setEditMode(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Banco</label>
                  <select className="form-select" value={editForm.banco} onChange={e => setEditForm(p => ({ ...p, banco: e.target.value }))}>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de Cuenta</label>
                  <select className="form-select" value={editForm.tipoCuenta} onChange={e => setEditForm(p => ({ ...p, tipoCuenta: e.target.value }))}>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Número de Cuenta</label>
                  <input className="form-input" value={editForm.numeroCuenta} onChange={e => setEditForm(p => ({ ...p, numeroCuenta: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Saldo Inicial ({config.currency})</label>
                  <input className="form-input" type="number" step="0.01" value={editForm.saldoInicial} onChange={e => setEditForm(p => ({ ...p, saldoInicial: +e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Fecha del Saldo Inicial</label>
                <input className="form-input" type="date" value={editForm.fechaSaldoInicial} onChange={e => setEditForm(p => ({ ...p, fechaSaldoInicial: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 4 }}>
                <label className="form-label">Métodos de pago vinculados</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {(config.metodosPago || []).map(m => {
                    const sel = (editForm.metodosVinculados || []).includes(m);
                    return (
                      <button key={m} type="button"
                        style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: sel ? 700 : 400, background: sel ? "var(--accent)" : "var(--bg3)", color: sel ? "#fff" : "var(--text2)", border: sel ? "1px solid var(--accent)" : "1px solid var(--border)" }}
                        onClick={() => setEditForm(p => ({ ...p, metodosVinculados: sel ? p.metodosVinculados.filter(x => x !== m) : [...(p.metodosVinculados || []), m] }))}>
                        {sel ? "✓ " : ""}{m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-danger btn-sm" onClick={handleDeactivate}>Desactivar cuenta</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEditMode(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveEdit}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta visual estilo banco ───────────────────────────────
function BankCard({ cb, balance, cur }) {
  const [showNumber, setShowNumber] = useState(false);
  const num = cb.numeroCuenta || "";
  const masked = num.length > 4 ? "•••• •••• " + num.slice(-4) : num || "•••• ••••";

  const GRADIENTS = {
    "Banco Unión":                    "linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)",
    "BNB":                             "linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #d32f2f 100%)",
    "Banco Mercantil Santa Cruz":     "linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #388e3c 100%)",
    "Banco BISA":                      "linear-gradient(135deg, #e65100 0%, #ef6c00 50%, #f57c00 100%)",
    "Banco Económico":                 "linear-gradient(135deg, #4a148c 0%, #6a1b9a 50%, #7b1fa2 100%)",
    "default":                         "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  };
  const grad = GRADIENTS[cb.banco] || GRADIENTS["default"];

  return (
    <div style={{
      background: grad, borderRadius: 20, padding: "28px 32px",
      color: "white", maxWidth: 420, position: "relative", overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    }}>
      {/* Círculos decorativos */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
      <div style={{ position: "absolute", bottom: -60, right: 40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Banco</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.02em" }}>{cb.banco || "Mi Banco"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{cb.tipoCuenta || "Cuenta"}</div>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
            {showNumber ? (num || "—") : masked}
            <button onClick={() => setShowNumber(s => !s)}
              style={{ marginLeft: 8, background: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>
              {showNumber ? "ocultar" : "ver"}
            </button>
          </div>
        </div>
      </div>

      {/* Balance */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Saldo Disponible</div>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-1px", textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
          {cur} {balance.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, opacity: 0.6 }}>Desde {cb.fechaSaldoInicial || "—"}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(cb.metodosVinculados || []).map(m => (
            <span key={m} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: "rgba(255,255,255,0.15)", fontWeight: 600, letterSpacing: "0.03em" }}>{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
