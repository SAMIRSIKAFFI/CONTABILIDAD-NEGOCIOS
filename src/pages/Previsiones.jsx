import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";

// ─── Helpers de fecha Bolivia (mes = 30 días) ──────────────────
function calcPeriodo(fechaInicio, fechaFin) {
  const ini = new Date(fechaInicio + "T00:00:00");
  const fin = new Date((fechaFin || new Date().toISOString().split("T")[0]) + "T00:00:00");
  let meses = (fin.getFullYear() - ini.getFullYear()) * 12 + (fin.getMonth() - ini.getMonth());
  let dias  = fin.getDate() - ini.getDate();
  if (dias < 0) { meses--; dias += 30; }
  if (meses < 0) { meses = 0; dias = 0; }
  return { meses, dias, totalDias: meses * 30 + dias };
}

function calcIndemnizacion(sueldo, fechaIngreso, fechaBaja) {
  const { totalDias } = calcPeriodo(fechaIngreso, fechaBaja);
  return (sueldo / 360) * totalDias;
}

function calcAguinaldo(sueldo, fechaIngreso, fechaBaja) {
  // Aguinaldo boliviano: desde 1-Ene del año en curso (o fecha ingreso si es posterior)
  // hasta 31-Dic del año en curso (o fecha baja si es anterior) — duodécimas
  const inicio   = new Date(fechaIngreso + "T00:00:00");
  const finRef   = fechaBaja ? new Date(fechaBaja + "T00:00:00") : new Date();
  const anio     = finRef.getFullYear();
  const ene1     = new Date(anio, 0, 1);   // 1 de enero del año en curso
  const dic31    = new Date(anio, 11, 31); // 31 de diciembre del año en curso
  const desde    = inicio > ene1  ? inicio : ene1;
  const hasta    = fechaBaja ? (finRef < dic31 ? finRef : dic31) : dic31;
  if (desde > hasta) return 0;
  const { totalDias } = calcPeriodo(
    desde.toISOString().split("T")[0],
    hasta.toISOString().split("T")[0]
  );
  return Math.max(0, (sueldo / 360) * totalDias);
}

function periodoLabel(fechaInicio, fechaFin) {
  const { meses, dias } = calcPeriodo(fechaInicio, fechaFin);
  const parts = [];
  if (meses > 0) parts.push(`${meses} mes${meses !== 1 ? "es" : ""}`);
  if (dias > 0)  parts.push(`${dias} día${dias !== 1 ? "s" : ""}`);
  return parts.length ? parts.join(" y ") : "0 días";
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

const EMPTY_EMPLEADO = { id: "", nombre: "", ci: "", cargo: "", fechaIngreso: "", fechaBaja: "", sueldo: 0, activo: true, notas: "" };
const EMPTY_OTRA     = { id: "", descripcion: "", monto: 0 };
const EMPTY_CHEQUE   = { id: "", cliente: "", descripcion: "", monto: 0, fechaEmision: "", fechaVencimiento: "", cobrado: false };

export default function Previsiones() {
  const { config, setConfig, isReadOnly, getTaxForecast, getQuarterTaxForecast } = useApp();
  const cur = config.currency || "Bs";

  const personal          = config.personal          || [];
  const previsionesOtras  = config.previsionesOtras  || [];
  const chequesPendientes = config.chequesPendientes || [];

  // ── Modal states ─────────────────────────────────────────────
  const [modalEmp,    setModalEmp]    = useState(null); // null | {mode, data}
  const [modalOtra,   setModalOtra]   = useState(null);
  const [modalCheque, setModalCheque] = useState(null);

  // ── CRUD Personal ─────────────────────────────────────────────
  const saveEmpleado = (form) => {
    const list = form.id
      ? personal.map(e => e.id === form.id ? form : e)
      : [...personal, { ...form, id: generateId() }];
    setConfig(p => ({ ...p, personal: list }));
    setModalEmp(null);
  };
  const deleteEmpleado = (id) => {
    if (!confirm("¿Eliminar este trabajador?")) return;
    setConfig(p => ({ ...p, personal: personal.filter(e => e.id !== id) }));
  };

  // ── CRUD Otras previsiones ────────────────────────────────────
  const saveOtra = (form) => {
    const list = form.id
      ? previsionesOtras.map(o => o.id === form.id ? form : o)
      : [...previsionesOtras, { ...form, id: generateId() }];
    setConfig(p => ({ ...p, previsionesOtras: list }));
    setModalOtra(null);
  };
  const deleteOtra = (id) => {
    setConfig(p => ({ ...p, previsionesOtras: previsionesOtras.filter(o => o.id !== id) }));
  };

  // ── CRUD Cheques ──────────────────────────────────────────────
  const saveCheque = (form) => {
    const list = form.id
      ? chequesPendientes.map(c => c.id === form.id ? form : c)
      : [...chequesPendientes, { ...form, id: generateId() }];
    setConfig(p => ({ ...p, chequesPendientes: list }));
    setModalCheque(null);
  };
  const deleteCheque = (id) => {
    setConfig(p => ({ ...p, chequesPendientes: chequesPendientes.filter(c => c.id !== id) }));
  };
  const marcarCobrado = (id) => {
    setConfig(p => ({ ...p, chequesPendientes: chequesPendientes.map(c => c.id === id ? { ...c, cobrado: !c.cobrado } : c) }));
  };

  // ── Cálculos ─────────────────────────────────────────────────
  const hoy = new Date().toISOString().split("T")[0];
  const curMonth = new Date().getMonth() + 1;
  const curYear  = new Date().getFullYear();
  const curQ     = Math.ceil(curMonth / 3);

  const empleadosCalc = useMemo(() => personal.map(emp => {
    const fechaFin = emp.fechaBaja || hoy;
    return {
      ...emp,
      periodo:       periodoLabel(emp.fechaIngreso, fechaFin),
      indemnizacion: calcIndemnizacion(emp.sueldo, emp.fechaIngreso, emp.fechaBaja || null),
      aguinaldo:     calcAguinaldo(emp.sueldo, emp.fechaIngreso, emp.fechaBaja || null),
    };
  }), [personal]);

  const totalIndem  = empleadosCalc.reduce((s, e) => s + e.indemnizacion, 0);
  const totalAguin  = empleadosCalc.reduce((s, e) => s + e.aguinaldo, 0);
  const totalSuel   = personal.filter(e => e.activo && !e.fechaBaja).reduce((s, e) => s + e.sueldo, 0);

  // Impuestos previstos del mes actual
  const ivaF  = getTaxForecast("iva",   curMonth, curYear);
  const itF   = getTaxForecast("it",    curMonth, curYear);
  const rcF   = getQuarterTaxForecast("rciva", `${curYear}-Q${curQ}`);
  const totalImp = ivaF + itF + rcF;

  const totalOtras   = previsionesOtras.reduce((s, o) => s + (o.monto || 0), 0);
  const totalPrev    = totalIndem + totalAguin + totalOtras + totalImp;

  const chequesPend  = chequesPendientes.filter(c => !c.cobrado);
  const totalCheques = chequesPend.reduce((s, c) => s + (c.monto || 0), 0);

  const saldoBanco   = (() => {
    const cb = config.cuentaBancaria;
    if (!cb?.activa) return null;
    return null; // se calcula en el módulo Banco, aquí solo referenciamos
  })();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Previsiones</h1>
          <p className="page-subtitle">Personal, impuestos, obligaciones y cheques pendientes de cobro</p>
        </div>
      </div>

      {/* ── Resumen ejecutivo ── */}
      <div className="grid-4" style={{ gap: 14, marginBottom: 24 }}>
        <SumCard label="Indemnización + Aguinaldo" value={fmt(totalIndem + totalAguin, cur)} color="var(--accent-red)"     icon="👥" sub={`${personal.length} trabajador${personal.length !== 1 ? "es" : ""}`} />
        <SumCard label="Impuestos previstos"        value={fmt(totalImp, cur)}               color="var(--accent-yellow)"   icon="🧾" sub={`IVA + IT + RC-IVA`} />
        <SumCard label="Otras previsiones"          value={fmt(totalOtras, cur)}             color="#a78bfa"                icon="📝" sub={`${previsionesOtras.length} concepto${previsionesOtras.length !== 1 ? "s" : ""}`} />
        <SumCard label="Cheques por cobrar"         value={fmt(totalCheques, cur)}           color="var(--accent-green)"    icon="💳" sub={`${chequesPend.length} pendiente${chequesPend.length !== 1 ? "s" : ""}`} />
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECCIÓN 1: PERSONAL
      ═══════════════════════════════════════════════════════ */}
      <SectionHeader title="👥 Personal" onAdd={!isReadOnly ? () => setModalEmp({ mode: "add", data: { ...EMPTY_EMPLEADO, fechaIngreso: hoy } }) : null} addLabel="+ Agregar trabajador" />

      {empleadosCalc.length === 0 ? (
        <EmptySection icon="👥" text="Sin trabajadores registrados" />
      ) : (
        <div className="table-wrap" style={{ marginBottom: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>CI</th>
                <th>Cargo</th>
                <th>Ingreso</th>
                <th>Baja</th>
                <th style={{ textAlign: "right" }}>Sueldo</th>
                <th>Tiempo</th>
                <th style={{ textAlign: "right" }}>Indemnización</th>
                <th style={{ textAlign: "right" }}>Aguinaldo</th>
                <th style={{ textAlign: "center" }}>Estado</th>
                {!isReadOnly && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {empleadosCalc.map(emp => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600 }}>{emp.nombre}</td>
                  <td style={{ fontSize: 12, color: "var(--text3)" }}>{emp.ci || "—"}</td>
                  <td style={{ fontSize: 12 }}>{emp.cargo || "—"}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(emp.fechaIngreso)}</td>
                  <td style={{ fontSize: 12 }}>{emp.fechaBaja ? fmtDate(emp.fechaBaja) : <span style={{ color: "var(--accent-green)", fontSize: 11 }}>Activo</span>}</td>
                  <td className="num-col" style={{ textAlign: "right" }}>{fmt(emp.sueldo, cur)}</td>
                  <td style={{ fontSize: 12, color: "var(--text3)" }}>{emp.periodo}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-red)" }}>{fmt(emp.indemnizacion, cur)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#a87c0a" }}>{fmt(emp.aguinaldo, cur)}</td>
                  <td style={{ textAlign: "center" }}>
                    <span className={`badge badge-${emp.activo && !emp.fechaBaja ? "green" : "red"}`}>
                      {emp.activo && !emp.fechaBaja ? "Activo" : "Baja"}
                    </span>
                  </td>
                  {!isReadOnly && (
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setModalEmp({ mode: "edit", data: emp })}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteEmpleado(emp.id)}>🗑️</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(79,142,247,0.07)", fontWeight: 700 }}>
                <td colSpan={5} style={{ paddingLeft: 12 }}>TOTALES</td>
                <td style={{ textAlign: "right" }}>{fmt(totalSuel, cur)}/mes</td>
                <td />
                <td style={{ textAlign: "right", color: "var(--accent-red)" }}>{fmt(totalIndem, cur)}</td>
                <td style={{ textAlign: "right", color: "#a87c0a" }}>{fmt(totalAguin, cur)}</td>
                <td colSpan={isReadOnly ? 1 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Nota metodología */}
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 24, fontStyle: "italic", paddingLeft: 4, lineHeight: 1.6 }}>
        💡 <strong>Indemnización:</strong> Sueldo × días totales trabajados ÷ 360 (mes boliviano = 30 días). Computa desde la fecha de ingreso.<br/>
        💡 <strong>Aguinaldo (duodécimas):</strong> Sueldo × días en el año en curso ÷ 360. Período: 1 de enero (o fecha de ingreso si es posterior) hasta 31 de diciembre (o fecha de baja). Para empleados activos se proyecta el aguinaldo completo al 31 de diciembre.
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECCIÓN 2: IMPUESTOS PREVISTOS
      ═══════════════════════════════════════════════════════ */}
      <SectionHeader title="🧾 Impuestos Previstos" />
      <div className="grid-3" style={{ gap: 14, marginBottom: 24 }}>
        <TaxPrevCard label="IVA" rate="13%" monto={ivaF} cur={cur}
          sub={`Mes: ${new Date().toLocaleString("es-BO", { month: "long" })} — vence 16/${new Date().getMonth() + 2 > 12 ? "01" : new Date().getMonth() + 2}`} />
        <TaxPrevCard label="IT" rate="3%" monto={itF} cur={cur}
          sub={`Mes: ${new Date().toLocaleString("es-BO", { month: "long" })} — vence 16/${new Date().getMonth() + 2 > 12 ? "01" : new Date().getMonth() + 2}`} />
        <TaxPrevCard label="RC-IVA" rate="12.5%" monto={rcF} cur={cur} color="#a78bfa"
          sub={`Trimestre Q${curQ} — acumulado 3 meses`} />
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECCIÓN 3: OTRAS PREVISIONES
      ═══════════════════════════════════════════════════════ */}
      <SectionHeader title="📝 Otras Previsiones" onAdd={!isReadOnly ? () => setModalOtra({ mode: "add", data: { ...EMPTY_OTRA } }) : null} addLabel="+ Agregar concepto" />

      {previsionesOtras.length === 0 ? (
        <EmptySection icon="📝" text='Sin conceptos. Agrega sueldos del mes, gastos operativos, etc.' />
      ) : (
        <div className="table-wrap" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th style={{ textAlign: "right" }}>Monto Previsto</th>
                {!isReadOnly && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {previsionesOtras.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.descripcion}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-red)" }}>{fmt(o.monto, cur)}</td>
                  {!isReadOnly && (
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setModalOtra({ mode: "edit", data: o })}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteOtra(o.id)}>🗑️</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(79,142,247,0.07)", fontWeight: 700 }}>
                <td style={{ paddingLeft: 12 }}>TOTAL OTRAS PREVISIONES</td>
                <td style={{ textAlign: "right", color: "var(--accent-red)" }}>{fmt(totalOtras, cur)}</td>
                {!isReadOnly && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECCIÓN 4: CHEQUES PENDIENTES
      ═══════════════════════════════════════════════════════ */}
      <SectionHeader title="💳 Cheques Pendientes de Cobro" onAdd={!isReadOnly ? () => setModalCheque({ mode: "add", data: { ...EMPTY_CHEQUE, fechaEmision: hoy } }) : null} addLabel="+ Agregar cheque" />

      {chequesPendientes.length === 0 ? (
        <EmptySection icon="💳" text="Sin cheques registrados" />
      ) : (
        <div className="table-wrap" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Descripción</th>
                <th>Emisión</th>
                <th>Vencimiento</th>
                <th style={{ textAlign: "right" }}>Monto</th>
                <th style={{ textAlign: "center" }}>Estado</th>
                {!isReadOnly && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {chequesPendientes.map(c => {
                const vencido = c.fechaVencimiento && c.fechaVencimiento < hoy && !c.cobrado;
                return (
                  <tr key={c.id} style={{ opacity: c.cobrado ? 0.55 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{c.cliente}</td>
                    <td style={{ fontSize: 12 }}>{c.descripcion}</td>
                    <td style={{ fontSize: 12 }}>{c.fechaEmision ? fmtDate(c.fechaEmision) : "—"}</td>
                    <td style={{ fontSize: 12, color: vencido ? "var(--accent-red)" : "inherit" }}>
                      {c.fechaVencimiento ? fmtDate(c.fechaVencimiento) : "—"}
                      {vencido && <span style={{ fontSize: 10, marginLeft: 4, color: "var(--accent-red)" }}>VENCIDO</span>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: c.cobrado ? "var(--accent-green)" : "var(--text)" }}>
                      {fmt(c.monto, cur)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`badge badge-${c.cobrado ? "green" : vencido ? "red" : "blue"}`}>
                        {c.cobrado ? "✅ Cobrado" : vencido ? "🔴 Vencido" : "⏳ Pendiente"}
                      </span>
                    </td>
                    {!isReadOnly && (
                      <td>
                        <div className="td-actions">
                          <button className="btn btn-ghost btn-sm" title={c.cobrado ? "Marcar pendiente" : "Marcar cobrado"}
                            onClick={() => marcarCobrado(c.id)}>
                            {c.cobrado ? "↩️" : "✅"}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModalCheque({ mode: "edit", data: c })}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteCheque(c.id)}>🗑️</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(45,212,160,0.07)", fontWeight: 700 }}>
                <td colSpan={4} style={{ paddingLeft: 12 }}>TOTAL PENDIENTE DE COBRO</td>
                <td style={{ textAlign: "right", color: "var(--accent-green)" }}>{fmt(totalCheques, cur)}</td>
                <td colSpan={isReadOnly ? 1 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECCIÓN 5: POSICIÓN NETA
      ═══════════════════════════════════════════════════════ */}
      <SectionHeader title="⚖️ Posición Neta" />
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <LineaCalculo label="Total Indemnizaciones"                       monto={-totalIndem}  cur={cur} />
          <LineaCalculo label="Total Aguinaldos"                            monto={-totalAguin}  cur={cur} />
          <LineaCalculo label="Impuestos previstos (IVA + IT + RC-IVA)"    monto={-totalImp}    cur={cur} />
          <LineaCalculo label="Otras previsiones"                           monto={-totalOtras}  cur={cur} />
          <div style={{ borderTop: "2px solid var(--border)", marginTop: 6, paddingTop: 10 }} />
          <LineaCalculo label="TOTAL PREVISIONES (obligaciones)"            monto={-totalPrev}   cur={cur} bold color="var(--accent-red)" />
          <div style={{ borderTop: "1px dashed var(--border)", marginTop: 8, paddingTop: 10 }} />
          <LineaCalculo label="(+) Cheques pendientes de cobro"             monto={totalCheques} cur={cur} color="var(--accent-green)" />
          <div style={{ borderTop: "2px solid var(--border)", marginTop: 8, paddingTop: 12 }} />

          {/* Posición sin cheques */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>
              📊 Saldo bancario <strong>menos</strong> previsiones
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text3)", fontStyle: "italic" }}>
              (Saldo banco) − {fmt(totalPrev, cur)}
            </span>
          </div>

          {/* Posición con cheques */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderRadius: 12, background: (totalCheques - totalPrev) >= 0 ? "rgba(45,212,160,0.10)" : "rgba(247,86,106,0.08)", border: `2px solid ${(totalCheques - totalPrev) >= 0 ? "rgba(45,212,160,0.4)" : "rgba(247,86,106,0.35)"}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                💡 Posición neta: previsiones vs. cheques por cobrar
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                Cheques pendientes − Total previsiones
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: (totalCheques - totalPrev) >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                {fmt(totalCheques - totalPrev, cur)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>
                {(totalCheques - totalPrev) >= 0 ? "✅ Los cobros cubren las obligaciones" : "⚠️ Faltan fondos para cubrir obligaciones"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modales ─────────────────────────────────────────── */}
      {modalEmp && (
        <ModalEmpleado
          data={modalEmp.data}
          onSave={saveEmpleado}
          onClose={() => setModalEmp(null)}
          cur={cur}
        />
      )}
      {modalOtra && (
        <ModalOtra
          data={modalOtra.data}
          onSave={saveOtra}
          onClose={() => setModalOtra(null)}
          cur={cur}
        />
      )}
      {modalCheque && (
        <ModalCheque
          data={modalCheque.data}
          onSave={saveCheque}
          onClose={() => setModalCheque(null)}
          cur={cur}
        />
      )}
    </div>
  );
}

// ─── Componentes UI ────────────────────────────────────────────

function SumCard({ label, value, color, icon, sub }) {
  return (
    <div className="card" style={{ padding: "16px 18px", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TaxPrevCard({ label, rate, monto, cur, sub, color = "var(--accent-yellow)" }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{label}</span>
        <span className="badge badge-blue">{rate}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{fmt(monto, cur)}</div>
      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function SectionHeader({ title, onAdd, addLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ height: 1, width: 20, background: "var(--border)" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
        <div style={{ height: 1, width: 40, background: "var(--border)" }} />
      </div>
      {onAdd && <button className="btn btn-ghost btn-sm" onClick={onAdd}>{addLabel}</button>}
    </div>
  );
}

function EmptySection({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0 28px", color: "var(--text3)", fontSize: 13 }}>
      <span style={{ fontSize: 24, display: "block", marginBottom: 6 }}>{icon}</span>
      {text}
    </div>
  );
}

function LineaCalculo({ label, monto, cur, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 4px", borderBottom: "1px solid var(--bg3)" }}>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? "var(--text)" : "var(--text2)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, fontVariantNumeric: "tabular-nums", color: color || (monto >= 0 ? "var(--accent-green)" : "var(--accent-red)") }}>
        {monto >= 0 ? "+" : ""}{fmt(monto, cur)}
      </span>
    </div>
  );
}

// ─── Modal Empleado ────────────────────────────────────────────
function ModalEmpleado({ data, onSave, onClose, cur }) {
  const [form, setForm] = useState({ ...data });
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const preview = form.fechaIngreso ? {
    indem: calcIndemnizacion(form.sueldo, form.fechaIngreso, form.fechaBaja || null),
    aguin: calcAguinaldo(form.sueldo, form.fechaIngreso, form.fechaBaja || null),
    per:   periodoLabel(form.fechaIngreso, form.fechaBaja || new Date().toISOString().split("T")[0]),
  } : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h2 className="modal-title">👤 {data.id ? "Editar" : "Agregar"} Trabajador</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <input className="form-input" value={form.nombre} onChange={e => f("nombre", e.target.value)} placeholder="Ej: Juan Pérez Mamani" />
            </div>
            <div className="form-group">
              <label className="form-label">CI / Documento</label>
              <input className="form-input" value={form.ci} onChange={e => f("ci", e.target.value)} placeholder="Ej: 7654321" />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Cargo / Función</label>
              <input className="form-input" value={form.cargo} onChange={e => f("cargo", e.target.value)} placeholder="Ej: Vendedor, Contador..." />
            </div>
            <div className="form-group">
              <label className="form-label">Sueldo Mensual ({cur})</label>
              <input className="form-input" type="number" step="0.01" min="0" value={form.sueldo} onChange={e => f("sueldo", +e.target.value)} />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Fecha de Ingreso *</label>
              <input className="form-input" type="date" value={form.fechaIngreso} onChange={e => f("fechaIngreso", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Baja (si aplica)</label>
              <input className="form-input" type="date" value={form.fechaBaja || ""} onChange={e => f("fechaBaja", e.target.value || "")} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" rows={2} value={form.notas} onChange={e => f("notas", e.target.value)} placeholder="Observaciones adicionales..." />
          </div>

          {/* Preview de cálculos */}
          {preview && form.sueldo > 0 && (
            <div style={{ background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.25)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 10 }}>📊 Vista previa de cálculos</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>PERÍODO</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{preview.per}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>INDEMNIZACIÓN</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-red)" }}>{fmt(preview.indem, cur)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>AGUINALDO</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#a87c0a" }}>{fmt(preview.aguin, cur)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { if (!form.nombre || !form.fechaIngreso) return alert("Nombre y fecha de ingreso son obligatorios"); onSave(form); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Otra Previsión ──────────────────────────────────────
function ModalOtra({ data, onSave, onClose, cur }) {
  const [form, setForm] = useState({ ...data });
  const SUGERENCIAS = ["Sueldos del mes", "Gastos operativos", "Alquiler", "Servicios básicos", "Mantenimiento", "Publicidad", "Otros gastos"];
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">📝 {data.id ? "Editar" : "Nueva"} Previsión</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Descripción *</label>
            <input className="form-input" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Sueldos del mes" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {SUGERENCIAS.map(s => (
                <button key={s} type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "2px 8px" }}
                  onClick={() => setForm(p => ({ ...p, descripcion: s }))}>{s}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Monto ({cur})</label>
            <input className="form-input" type="number" step="0.01" min="0" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: +e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { if (!form.descripcion) return alert("Descripción obligatoria"); onSave(form); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Cheque ──────────────────────────────────────────────
function ModalCheque({ data, onSave, onClose, cur }) {
  const [form, setForm] = useState({ ...data });
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">💳 {data.id ? "Editar" : "Nuevo"} Cheque Pendiente</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Cliente *</label>
              <input className="form-input" value={form.cliente} onChange={e => f("cliente", e.target.value)} placeholder="Nombre del cliente" />
            </div>
            <div className="form-group">
              <label className="form-label">Monto ({cur}) *</label>
              <input className="form-input" type="number" step="0.01" min="0" value={form.monto} onChange={e => f("monto", +e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Descripción / Concepto</label>
            <input className="form-input" value={form.descripcion} onChange={e => f("descripcion", e.target.value)} placeholder="Ej: Factura #123 - Alquiler Mayo" />
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Fecha de Emisión</label>
              <input className="form-input" type="date" value={form.fechaEmision} onChange={e => f("fechaEmision", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Vencimiento</label>
              <input className="form-input" type="date" value={form.fechaVencimiento} onChange={e => f("fechaVencimiento", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { if (!form.cliente || !form.monto) return alert("Cliente y monto son obligatorios"); onSave(form); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
