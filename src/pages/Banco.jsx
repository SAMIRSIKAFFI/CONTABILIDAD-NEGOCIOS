import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const BANKS = [
  "Banco Unión","BNB","Banco Mercantil Santa Cruz","Banco BISA","Banco Económico",
  "Banco de Crédito de Bolivia","Banco FIE","Banco Solidario","Banco PyME Los Andes","Otro",
];
const ACCOUNT_TYPES = ["Cuenta Corriente","Caja de Ahorro","Cuenta Empresarial"];
const CARD_GRADIENTS = [
  "linear-gradient(135deg,#1a237e 0%,#283593 50%,#3949ab 100%)",
  "linear-gradient(135deg,#b71c1c 0%,#c62828 50%,#d32f2f 100%)",
  "linear-gradient(135deg,#1b5e20 0%,#2e7d32 50%,#388e3c 100%)",
  "linear-gradient(135deg,#e65100 0%,#ef6c00 50%,#f57c00 100%)",
  "linear-gradient(135deg,#4a148c 0%,#6a1b9a 50%,#7b1fa2 100%)",
  "linear-gradient(135deg,#006064 0%,#00838f 50%,#0097a7 100%)",
  "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)",
];

const BANK_GRADIENTS = {
  "Banco Unión": CARD_GRADIENTS[0],
  "BNB": CARD_GRADIENTS[1],
  "Banco Mercantil Santa Cruz": CARD_GRADIENTS[2],
  "Banco BISA": CARD_GRADIENTS[3],
  "Banco Económico": CARD_GRADIENTS[4],
};

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

function downloadCSV(content, filename) {
  const bom = "﻿";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_CUENTA = {
  id: "", banco: "", numeroCuenta: "", tipoCuenta: "Cuenta Corriente",
  saldoInicial: 0, fechaSaldoInicial: new Date().toISOString().split("T")[0],
  metodosVinculados: [], activa: true,
};

export default function Banco() {
  const { config, setConfig, ingresos, gastos, costos, isReadOnly } = useApp();

  // Migrar de cuenta única a múltiples cuentas
  const cuentas = useMemo(() => {
    if (config.cuentasBancarias?.length > 0) return config.cuentasBancarias;
    if (config.cuentaBancaria?.activa) return [{ ...config.cuentaBancaria, id: config.cuentaBancaria.id || "legacy" }];
    return [];
  }, [config.cuentasBancarias, config.cuentaBancaria]);

  const [selectedId, setSelectedId]   = useState(null);
  const [modalCuenta, setModalCuenta] = useState(null); // null | {mode, data}

  const selectedCuenta = cuentas.find(c => c.id === selectedId) || cuentas[0] || null;

  // ── CRUD cuentas ─────────────────────────────────────────────
  const saveCuenta = (form) => {
    let updated;
    if (form.id) {
      updated = cuentas.map(c => c.id === form.id ? form : c);
    } else {
      const nueva = { ...form, id: generateId() };
      updated = [...cuentas, nueva];
      setSelectedId(nueva.id);
    }
    setConfig(p => ({ ...p, cuentasBancarias: updated, cuentaBancaria: { activa: false } }));
    setModalCuenta(null);
  };

  const deleteCuenta = (id) => {
    if (!confirm("¿Eliminar esta cuenta bancaria?")) return;
    const updated = cuentas.filter(c => c.id !== id);
    setConfig(p => ({ ...p, cuentasBancarias: updated }));
    if (selectedId === id) setSelectedId(updated[0]?.id || null);
  };

  // ── Movimientos de la cuenta seleccionada ────────────────────
  const movimientos = useMemo(() => {
    if (!selectedCuenta) return [];
    const cid     = selectedCuenta.id;
    const methods = new Set(selectedCuenta.metodosVinculados || []);
    const cutoff  = selectedCuenta.fechaSaldoInicial || "2000-01-01";
    // Match by cuentaBancariaId (new) OR metodoPago (legacy fallback)
    const match = x => x.fecha >= cutoff && (
      x.cuentaBancariaId === cid ||
      (!x.cuentaBancariaId && methods.has(x.metodoPago))
    );
    const all = [
      ...ingresos.filter(match).map(x => ({
        id: x.id, fecha: x.fecha, tipo: "ingreso", categoria: x.categoria,
        descripcion: x.descripcion || "", monto: x.ingresoTotal || 0,
      })),
      ...gastos.filter(match).map(x => ({
        id: x.id, fecha: x.fecha, tipo: "gasto", categoria: x.categoria,
        descripcion: x.descripcion || "", monto: -(x.gastoTotal || 0),
      })),
      ...costos.filter(match).map(x => ({
        id: x.id, fecha: x.fecha, tipo: "costo", categoria: x.categoria,
        descripcion: x.descripcion || "", monto: -(x.costoTotal || 0),
      })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

    let balance = selectedCuenta.saldoInicial || 0;
    return all.map(m => { balance += m.monto; return { ...m, balance }; }).reverse();
  }, [ingresos, gastos, costos, selectedCuenta]);

  // ── Totales cuenta seleccionada ───────────────────────────────
  const totalDeposits    = movimientos.filter(m => m.monto > 0).reduce((s, m) => s + m.monto, 0);
  const totalWithdrawals = movimientos.filter(m => m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0);
  const currentBalance   = movimientos.length > 0 ? movimientos[0].balance : (selectedCuenta?.saldoInicial || 0);

  // ── Saldo total de TODAS las cuentas ─────────────────────────
  const totalAllAccounts = useMemo(() => {
    return cuentas.reduce((total, cuenta) => {
      const cid     = cuenta.id;
      const methods = new Set(cuenta.metodosVinculados || []);
      const cutoff  = cuenta.fechaSaldoInicial || "2000-01-01";
      const match = x => x.fecha >= cutoff && (
        x.cuentaBancariaId === cid ||
        (!x.cuentaBancariaId && methods.has(x.metodoPago))
      );
      let bal = cuenta.saldoInicial || 0;
      ingresos.filter(match).forEach(x => bal += (x.ingresoTotal || 0));
      gastos.filter(match).forEach(x => bal -= (x.gastoTotal || 0));
      costos.filter(match).forEach(x => bal -= (x.costoTotal || 0));
      return total + bal;
    }, 0);
  }, [cuentas, ingresos, gastos, costos]);

  // ── Chart ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const byMonth = {};
    [...movimientos].reverse().forEach(m => {
      const key = m.fecha.substring(0, 7);
      byMonth[key] = m.balance;
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([k, v]) => ({ mes: k.substring(5), saldo: Math.round(v) }));
  }, [movimientos]);

  // ── Filtros movimientos ───────────────────────────────────────
  const [filter, setFilter]   = useState("todos");
  const [search, setSearch]   = useState("");
  const cur = config.currency || "Bs";

  const filtered = movimientos.filter(m => {
    if (filter !== "todos" && m.tipo !== filter) return false;
    if (search && !(m.descripcion.toLowerCase().includes(search.toLowerCase()) || m.categoria.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const handleExport = () => {
    if (!selectedCuenta) return;
    const n = v => v.toFixed(2).replace(".", ",");
    const headers = ["Fecha","Tipo","Categoría","Descripción","Movimiento","Saldo"];
    const lines = [headers.join(";"), ...movimientos.map(m =>
      [m.fecha, m.tipo, m.categoria, `"${m.descripcion.replace(/"/g,'""')}"`, n(m.monto), n(m.balance)].join(";")
    )];
    downloadCSV(lines.join("\n"), `Estado_Cuenta_${selectedCuenta.banco}_${new Date().toISOString().split("T")[0]}.csv`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Cuentas Bancarias</h1>
          <p className="page-subtitle">
            {cuentas.length} cuenta{cuentas.length !== 1 ? "s" : ""} vinculada{cuentas.length !== 1 ? "s" : ""} · Saldo total:
            <strong style={{ color: "var(--accent-green)", marginLeft: 6 }}>{fmt(totalAllAccounts, cur)}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selectedCuenta && <button className="btn btn-ghost" onClick={handleExport}>📤 Estado de cuenta</button>}
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={() => setModalCuenta({ mode: "add", data: { ...EMPTY_CUENTA } })}>
              + Nueva Cuenta
            </button>
          )}
        </div>
      </div>

      {cuentas.length === 0 ? (
        /* ── Sin cuentas ── */
        <div style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🏦</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Sin cuentas bancarias</h2>
          <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 28 }}>
            Vincula una o más cuentas para seguimiento automático del saldo.
          </p>
          {!isReadOnly && (
            <button className="btn btn-primary" style={{ padding: "12px 32px" }}
              onClick={() => setModalCuenta({ mode: "add", data: { ...EMPTY_CUENTA } })}>
              + Agregar primera cuenta
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Carrusel de tarjetas bancarias ── */}
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
            {cuentas.map((c, idx) => {
              const grad = BANK_GRADIENTS[c.banco] || CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
              const methods = new Set(c.metodosVinculados || []);
              const cutoff  = c.fechaSaldoInicial || "2000-01-01";
              let bal = c.saldoInicial || 0;
              ingresos.filter(x => x.fecha >= cutoff && methods.has(x.metodoPago)).forEach(x => bal += (x.ingresoTotal || 0));
              gastos.filter(x => x.fecha >= cutoff && methods.has(x.metodoPago)).forEach(x => bal -= (x.gastoTotal || 0));
              costos.filter(x => x.fecha >= cutoff && methods.has(x.metodoPago)).forEach(x => bal -= (x.costoTotal || 0));
              const isSelected = selectedCuenta?.id === c.id;
              return (
                <div key={c.id} onClick={() => setSelectedId(c.id)} style={{
                  background: grad, borderRadius: 16, padding: "20px 24px", color: "white",
                  minWidth: 280, maxWidth: 320, flexShrink: 0, cursor: "pointer", position: "relative",
                  overflow: "hidden", boxShadow: isSelected ? "0 0 0 3px #fff, 0 8px 30px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.2)",
                  transition: "box-shadow 0.2s", opacity: isSelected ? 1 : 0.8,
                }}>
                  <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em" }}>Banco</div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{c.banco || "—"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>{c.tipoCuenta}</div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>{c.numeroCuenta ? `•••• ${c.numeroCuenta.slice(-4)}` : "••••"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Saldo</div>
                  <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px" }}>
                    {cur} {bal.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                  {!isReadOnly && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button onClick={e => { e.stopPropagation(); setModalCuenta({ mode: "edit", data: c }); }}
                        style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", borderRadius: 6, padding: "3px 10px", fontSize: 11 }}>
                        ✏️ Editar
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteCuenta(c.id); }}
                        style={{ background: "rgba(255,0,0,0.25)", border: "none", color: "white", cursor: "pointer", borderRadius: 6, padding: "3px 10px", fontSize: 11 }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedCuenta && (
            <>
              {/* ── KPIs ── */}
              <div className="grid-3" style={{ gap: 14, marginBottom: 16 }}>
                <div className="card" style={{ padding: "14px 18px", borderTop: "3px solid var(--accent-green)" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Total Depósitos</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-green)" }}>{fmt(totalDeposits, cur)}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{movimientos.filter(m => m.monto > 0).length} ingresos</div>
                </div>
                <div className="card" style={{ padding: "14px 18px", borderTop: "3px solid var(--accent-red)" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Total Retiros</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-red)" }}>{fmt(totalWithdrawals, cur)}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{movimientos.filter(m => m.monto < 0).length} gastos</div>
                </div>
                <div className="card" style={{ padding: "14px 18px", borderTop: `3px solid ${currentBalance >= 0 ? "var(--accent-green)" : "var(--accent-red)"}` }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Saldo Actual</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: currentBalance >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{fmt(currentBalance, cur)}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Inicial: {fmt(selectedCuenta.saldoInicial || 0, cur)}</div>
                </div>
              </div>

              {/* ── Chart ── */}
              {chartData.length > 1 && (
                <div className="card" style={{ padding: 18, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>
                    📈 Evolución del Saldo — {selectedCuenta.banco}
                  </div>
                  <ResponsiveContainer width="100%" height={170}>
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
                      <Tooltip formatter={v => [fmt(v, cur), "Saldo"]} contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="saldo" stroke="#4f8ef7" strokeWidth={2.5} fill="url(#gradBank)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Movimientos ── */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>📋 Movimientos — {selectedCuenta.banco}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["todos","ingreso","gasto","costo"].map(f => (
                      <button key={f} onClick={() => setFilter(f)}
                        style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: filter===f?700:400, background: filter===f?"var(--accent)":"var(--bg3)", color: filter===f?"#fff":"var(--text3)", border: `1px solid ${filter===f?"var(--accent)":"var(--border)"}` }}>
                        {f==="todos"?"Todos":f==="ingreso"?"💰 Ingresos":f==="gasto"?"💸 Gastos":"🏭 Costos"}
                      </button>
                    ))}
                    <input className="form-input" style={{ margin:0, padding:"4px 12px", fontSize:11, width:150 }}
                      placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th>
                        <th style={{ textAlign:"right" }}>Movimiento</th>
                        <th style={{ textAlign:"right" }}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={6}><div className="empty-state"><div className="icon">🏦</div><p>Sin movimientos</p></div></td></tr>
                      ) : filtered.map(m => (
                        <tr key={m.id}>
                          <td style={{ whiteSpace:"nowrap" }}>{fmtDate(m.fecha)}</td>
                          <td><span className={`badge badge-${m.tipo==="ingreso"?"green":m.tipo==="gasto"?"red":"yellow"}`}>
                            {m.tipo==="ingreso"?"💰":m.tipo==="gasto"?"💸":"🏭"} {m.tipo}
                          </span></td>
                          <td style={{ fontSize:12 }}>{m.categoria}</td>
                          <td style={{ fontSize:12, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.descripcion}</td>
                          <td style={{ textAlign:"right", fontWeight:700, color:m.monto>=0?"var(--accent-green)":"var(--accent-red)", whiteSpace:"nowrap" }}>
                            {m.monto>=0?"+":""}{fmt(m.monto, cur)}
                          </td>
                          <td style={{ textAlign:"right", fontWeight:600, color:m.balance>=0?"var(--text)":"var(--accent-red)", whiteSpace:"nowrap" }}>
                            {fmt(m.balance, cur)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Modal cuenta ── */}
      {modalCuenta && (
        <ModalCuenta
          data={modalCuenta.data}
          metodosPago={config.metodosPago || []}
          currency={cur}
          onSave={saveCuenta}
          onClose={() => setModalCuenta(null)}
        />
      )}
    </div>
  );
}

function ModalCuenta({ data, metodosPago, currency, onSave, onClose }) {
  const [form, setForm] = useState({ ...data });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleMetodo = (m) => setForm(p => ({
    ...p,
    metodosVinculados: p.metodosVinculados.includes(m)
      ? p.metodosVinculados.filter(x => x !== m)
      : [...p.metodosVinculados, m]
  }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title">🏦 {data.id ? "Editar" : "Nueva"} Cuenta Bancaria</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Banco *</label>
              <select className="form-select" value={form.banco} onChange={e => f("banco", e.target.value)}>
                <option value="">Seleccionar banco...</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Cuenta</label>
              <select className="form-select" value={form.tipoCuenta} onChange={e => f("tipoCuenta", e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Número de Cuenta</label>
              <input className="form-input" value={form.numeroCuenta} onChange={e => f("numeroCuenta", e.target.value)} placeholder="Ej: 1234-5678" />
            </div>
            <div className="form-group">
              <label className="form-label">Saldo Inicial ({currency})</label>
              <input className="form-input" type="number" step="0.01" value={form.saldoInicial} onChange={e => f("saldoInicial", +e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Fecha del Saldo Inicial</label>
            <input className="form-input" type="date" value={form.fechaSaldoInicial} onChange={e => f("fechaSaldoInicial", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Métodos de pago vinculados a esta cuenta</label>
            <small style={{ color: "var(--text3)", display: "block", marginBottom: 8 }}>
              Solo las transacciones con estos métodos afectarán el saldo de esta cuenta
            </small>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {metodosPago.map(m => {
                const sel = form.metodosVinculados.includes(m);
                return (
                  <button key={m} type="button" onClick={() => toggleMetodo(m)}
                    style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: sel ? 700 : 400, background: sel ? "var(--accent)" : "var(--bg3)", color: sel ? "#fff" : "var(--text2)", border: sel ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                    {sel ? "✓ " : ""}{m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { if (!form.banco) return alert("Selecciona un banco"); onSave(form); }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
