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

function periodoLabel(fechaInicio, fechaFin) {
  const { meses, dias } = calcPeriodo(fechaInicio, fechaFin);
  const p = [];
  if (meses > 0) p.push(`${meses} mes${meses !== 1 ? "es" : ""}`);
  if (dias  > 0) p.push(`${dias} día${dias !== 1 ? "s" : ""}`);
  return p.length ? p.join(" y ") : "0 días";
}

// ─── Generación de períodos de Indemnización (aniversario a aniversario) ──
function generarPeriodosIndem(fechaIngreso, fechaBaja, sueldo) {
  const inicio = new Date(fechaIngreso + "T00:00:00");
  const fin    = fechaBaja ? new Date(fechaBaja + "T00:00:00") : new Date();
  const periodos = [];
  let pIni = new Date(inicio);

  while (pIni < fin) {
    // Fin del período = día antes del próximo aniversario
    const pFin = new Date(pIni);
    pFin.setFullYear(pFin.getFullYear() + 1);
    pFin.setDate(pFin.getDate() - 1);

    const hastaReal = pFin <= fin ? pFin : new Date(fin);
    const desdeStr  = pIni.toISOString().split("T")[0];
    const hastaStr  = hastaReal.toISOString().split("T")[0];
    const { totalDias } = calcPeriodo(desdeStr, hastaStr);

    periodos.push({
      key:        desdeStr,
      desde:      desdeStr,
      hasta:      hastaStr,
      esCompleto: pFin <= fin,
      totalDias,
      monto:      (sueldo / 360) * totalDias,
      label:      `${fmtDate(desdeStr)} → ${fmtDate(hastaStr)}`,
    });

    pIni = new Date(hastaReal);
    pIni.setDate(pIni.getDate() + 1);
    if (pIni >= fin) break;
  }
  return periodos;
}

// ─── Generación de períodos de Aguinaldo (1-Ene a 31-Dic por año) ────────
function generarPeriodosAguin(fechaIngreso, fechaBaja, sueldo) {
  const inicio    = new Date(fechaIngreso + "T00:00:00");
  const fin       = fechaBaja ? new Date(fechaBaja + "T00:00:00") : new Date();
  const anioIni   = inicio.getFullYear();
  const anioFin   = fin.getFullYear();
  const periodos  = [];

  for (let anio = anioIni; anio <= anioFin; anio++) {
    const ene1  = new Date(anio, 0, 1);
    const dic31 = new Date(anio, 11, 31);
    const desde = inicio > ene1  ? inicio : ene1;
    const hasta = fin    < dic31 ? fin    : dic31;
    if (desde > hasta) continue;
    const desdeStr = desde.toISOString().split("T")[0];
    const hastaStr = hasta.toISOString().split("T")[0];
    const { totalDias } = calcPeriodo(desdeStr, hastaStr);
    const esCompleto = hasta >= dic31 || (fechaBaja && new Date(fechaBaja) >= dic31);
    periodos.push({
      key:        String(anio),
      anio,
      desde:      desdeStr,
      hasta:      hastaStr,
      esCompleto,
      totalDias,
      monto:      (sueldo / 360) * totalDias,
      label:      `Aguinaldo ${anio} (${fmtDate(desdeStr)} → ${fmtDate(hastaStr)})`,
    });
  }
  return periodos;
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

const EMPTY_EMP    = { id:"", nombre:"", ci:"", cargo:"", fechaIngreso:"", fechaBaja:"", sueldo:0, activo:true, notas:"", pagosIndem:[], pagosAguin:[] };
const EMPTY_OTRA   = { id:"", descripcion:"", monto:0 };
const EMPTY_CHEQUE = { id:"", cliente:"", descripcion:"", monto:0, fechaEmision:"", fechaVencimiento:"", cobrado:false };

export default function Previsiones() {
  const { config, setConfig, isReadOnly, getTaxForecast, getQuarterTaxForecast } = useApp();
  const cur = config.currency || "Bs";

  const personal          = config.personal          || [];
  const previsionesOtras  = config.previsionesOtras  || [];
  const chequesPendientes = config.chequesPendientes || [];

  const [modalEmp,    setModalEmp]    = useState(null);
  const [modalOtra,   setModalOtra]   = useState(null);
  const [modalCheque, setModalCheque] = useState(null);
  const [modalPago,   setModalPago]   = useState(null); // { empId, tipo, periodoKey, periodoLabel, calculado, pagoExistente }
  const [expandedEmp, setExpandedEmp] = useState(null);

  // ── CRUD Personal ─────────────────────────────────────────────
  const saveEmpleado = (form) => {
    const base = { pagosIndem: [], pagosAguin: [], ...form };
    const list = form.id
      ? personal.map(e => e.id === form.id ? { ...e, ...base } : e)
      : [...personal, { ...base, id: generateId() }];
    setConfig(p => ({ ...p, personal: list }));
    setModalEmp(null);
  };
  const deleteEmpleado = (id) => {
    if (!confirm("¿Eliminar este trabajador y todos sus registros?")) return;
    setConfig(p => ({ ...p, personal: personal.filter(e => e.id !== id) }));
  };

  // ── Registro de pagos a cuenta ────────────────────────────────
  const savePago = ({ empId, tipo, periodoKey, monto, fecha, notas }) => {
    const emp = personal.find(e => e.id === empId);
    if (!emp) return;
    const campo = tipo === "indem" ? "pagosIndem" : "pagosAguin";
    const listaPagos = emp[campo] || [];

    // Buscar si ya existe pago para este período
    const existe = listaPagos.find(p => p.periodoKey === periodoKey);
    const nuevoPago = existe
      ? { ...existe, monto: +monto, fecha, notas }
      : { id: generateId(), periodoKey, monto: +monto, fecha, notas };
    const nuevaLista = existe
      ? listaPagos.map(p => p.periodoKey === periodoKey ? nuevoPago : p)
      : [...listaPagos, nuevoPago];

    const empActualizado = { ...emp, [campo]: nuevaLista };
    setConfig(p => ({ ...p, personal: personal.map(e => e.id === empId ? empActualizado : e) }));
    setModalPago(null);
  };

  const deletePago = (empId, tipo, periodoKey) => {
    const emp = personal.find(e => e.id === empId);
    if (!emp) return;
    const campo = tipo === "indem" ? "pagosIndem" : "pagosAguin";
    const nuevaLista = (emp[campo] || []).filter(p => p.periodoKey !== periodoKey);
    setConfig(p => ({ ...p, personal: personal.map(e => e.id === empId ? { ...e, [campo]: nuevaLista } : e) }));
  };

  // ── CRUD Otras ────────────────────────────────────────────────
  const saveOtra = (form) => {
    const list = form.id ? previsionesOtras.map(o => o.id===form.id?form:o) : [...previsionesOtras,{...form,id:generateId()}];
    setConfig(p => ({ ...p, previsionesOtras: list }));
    setModalOtra(null);
  };
  const deleteOtra = (id) => setConfig(p => ({ ...p, previsionesOtras: previsionesOtras.filter(o=>o.id!==id) }));

  // ── CRUD Cheques ──────────────────────────────────────────────
  const saveCheque = (form) => {
    const list = form.id ? chequesPendientes.map(c=>c.id===form.id?form:c) : [...chequesPendientes,{...form,id:generateId()}];
    setConfig(p => ({ ...p, chequesPendientes: list }));
    setModalCheque(null);
  };
  const deleteCheque = (id) => setConfig(p => ({ ...p, chequesPendientes: chequesPendientes.filter(c=>c.id!==id) }));
  const marcarCobrado = (id) => setConfig(p => ({ ...p, chequesPendientes: chequesPendientes.map(c=>c.id===id?{...c,cobrado:!c.cobrado}:c) }));

  // ── Cálculos globales ─────────────────────────────────────────
  const hoy         = new Date().toISOString().split("T")[0];
  const curMonth    = new Date().getMonth() + 1;
  const curYear     = new Date().getFullYear();
  const curQ        = Math.ceil(curMonth / 3);

  const empleadosCalc = useMemo(() => personal.map(emp => {
    const fechaFin   = emp.fechaBaja || hoy;
    const periIndem  = generarPeriodosIndem(emp.fechaIngreso, emp.fechaBaja || null, emp.sueldo);
    const periAguin  = generarPeriodosAguin(emp.fechaIngreso, emp.fechaBaja || null, emp.sueldo);
    const pagosIndem = emp.pagosIndem || [];
    const pagosAguin = emp.pagosAguin || [];

    const totalIndem  = periIndem.reduce((s,p) => s+p.monto, 0);
    const totalAguin  = periAguin.reduce((s,p) => s+p.monto, 0);
    const pagadoIndem = pagosIndem.reduce((s,p) => s+(p.monto||0), 0);
    const pagadoAguin = pagosAguin.reduce((s,p) => s+(p.monto||0), 0);
    const saldoIndem  = Math.max(0, totalIndem - pagadoIndem);
    const saldoAguin  = Math.max(0, totalAguin - pagadoAguin);

    return { ...emp, periIndem, periAguin, pagosIndem, pagosAguin, totalIndem, totalAguin, pagadoIndem, pagadoAguin, saldoIndem, saldoAguin, periodo: periodoLabel(emp.fechaIngreso, fechaFin) };
  }), [personal, hoy]);

  const totSaldoIndem = empleadosCalc.reduce((s,e)=>s+e.saldoIndem,0);
  const totSaldoAguin = empleadosCalc.reduce((s,e)=>s+e.saldoAguin,0);
  const totSueldo     = personal.filter(e=>e.activo&&!e.fechaBaja).reduce((s,e)=>s+e.sueldo,0);

  const ivaF  = getTaxForecast("iva",   curMonth, curYear);
  const itF   = getTaxForecast("it",    curMonth, curYear);
  const rcF   = getQuarterTaxForecast("rciva", `${curYear}-Q${curQ}`);
  const totalImp   = ivaF + itF + rcF;
  const totalOtras = previsionesOtras.reduce((s,o)=>s+(o.monto||0),0);
  const totalPrev  = totSaldoIndem + totSaldoAguin + totalOtras + totalImp;

  const chequesPend  = chequesPendientes.filter(c=>!c.cobrado);
  const totalCheques = chequesPend.reduce((s,c)=>s+(c.monto||0),0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Previsiones</h1>
          <p className="page-subtitle">Personal, pagos a cuenta, impuestos y cheques pendientes</p>
        </div>
      </div>

      {/* ── Resumen ── */}
      <div className="grid-4" style={{ gap:14, marginBottom:24 }}>
        <SumCard label="Saldo Indem. + Aguinaldo" value={fmt(totSaldoIndem+totSaldoAguin, cur)} color="var(--accent-red)"   icon="👥" sub="Pendiente de pago" />
        <SumCard label="Impuestos previstos"       value={fmt(totalImp, cur)}                    color="var(--accent-yellow)" icon="🧾" sub="IVA + IT + RC-IVA" />
        <SumCard label="Otras previsiones"         value={fmt(totalOtras, cur)}                  color="#a78bfa"              icon="📝" sub={`${previsionesOtras.length} concepto(s)`} />
        <SumCard label="Cheques por cobrar"        value={fmt(totalCheques, cur)}                color="var(--accent-green)"  icon="💳" sub={`${chequesPend.length} pendiente(s)`} />
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 1: PERSONAL CON PERÍODOS Y PAGOS A CUENTA
      ══════════════════════════════════════════════════════ */}
      <SectionHeader title="👥 Personal — Indemnización y Aguinaldo"
        onAdd={!isReadOnly ? ()=>setModalEmp({mode:"add",data:{...EMPTY_EMP,fechaIngreso:hoy}}) : null}
        addLabel="+ Agregar trabajador" />

      {empleadosCalc.length === 0 ? (
        <EmptySection icon="👥" text="Sin trabajadores registrados" />
      ) : empleadosCalc.map(emp => (
        <div key={emp.id} className="card" style={{ marginBottom:12, padding:0, overflow:"hidden" }}>

          {/* ── Fila resumen del empleado ── */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", gap:12, flexWrap:"wrap", cursor:"pointer", background: expandedEmp===emp.id ? "var(--bg2)" : "transparent" }}
            onClick={()=>setExpandedEmp(expandedEmp===emp.id ? null : emp.id)}>
            <div style={{ display:"flex", alignItems:"center", gap:14, flex:1, minWidth:200 }}>
              <div style={{ width:38, height:38, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:15, flexShrink:0 }}>
                {emp.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>{emp.nombre}</div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>{emp.cargo || "—"} · CI: {emp.ci || "—"} · Ingreso: {fmtDate(emp.fechaIngreso)}{emp.fechaBaja ? ` · Baja: ${fmtDate(emp.fechaBaja)}` : ""}</div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>Sueldo: {fmt(emp.sueldo,cur)} · Período: {emp.periodo}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
              <MiniStat label="Indem. Total"  v={fmt(emp.totalIndem,cur)}   c="var(--accent-red)" />
              <MiniStat label="Pagado Indem." v={fmt(emp.pagadoIndem,cur)}  c="var(--accent-green)" />
              <MiniStat label="Saldo Indem."  v={fmt(emp.saldoIndem,cur)}   c={emp.saldoIndem>0?"var(--accent-red)":"var(--accent-green)"} bold />
              <div style={{ width:1, background:"var(--border)" }} />
              <MiniStat label="Aguinaldo Total"  v={fmt(emp.totalAguin,cur)}  c="var(--accent-yellow)" />
              <MiniStat label="Pagado Aguin."    v={fmt(emp.pagadoAguin,cur)} c="var(--accent-green)" />
              <MiniStat label="Saldo Aguin."     v={fmt(emp.saldoAguin,cur)}  c={emp.saldoAguin>0?"var(--accent-yellow)":"var(--accent-green)"} bold />
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              {!isReadOnly && <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setModalEmp({mode:"edit",data:emp})}}>✏️</button>}
              {!isReadOnly && <button className="btn btn-danger btn-sm" onClick={e=>{e.stopPropagation();deleteEmpleado(emp.id)}}>🗑️</button>}
              <span style={{ fontSize:18, color:"var(--text3)", padding:"0 4px" }}>{expandedEmp===emp.id?"▲":"▼"}</span>
            </div>
          </div>

          {/* ── Detalle expandible: períodos ── */}
          {expandedEmp===emp.id && (
            <div style={{ borderTop:"1px solid var(--border)", background:"var(--bg3)", padding:18 }}>

              {/* Indemnización por períodos */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontWeight:700, fontSize:12, color:"var(--accent-red)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>
                  📌 Indemnización por períodos — sueldo actual: {fmt(emp.sueldo,cur)}
                </div>
                <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"var(--bg2)" }}>
                      <th style={{ padding:"6px 10px", textAlign:"left", fontWeight:600, color:"var(--text3)" }}>Período</th>
                      <th style={{ padding:"6px 10px", textAlign:"left", fontWeight:600, color:"var(--text3)" }}>Duración</th>
                      <th style={{ padding:"6px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>Calculado</th>
                      <th style={{ padding:"6px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>Pagado</th>
                      <th style={{ padding:"6px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>Saldo</th>
                      <th style={{ padding:"6px 10px", textAlign:"center", fontWeight:600, color:"var(--text3)" }}>Estado</th>
                      {!isReadOnly && <th style={{ padding:"6px 10px" }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {emp.periIndem.map((per, idx) => {
                      const pago = emp.pagosIndem.find(p=>p.periodoKey===per.key);
                      const pagado = pago?.monto || 0;
                      const saldo  = Math.max(0, per.monto - pagado);
                      const pagado100 = pagado >= per.monto * 0.999;
                      return (
                        <tr key={per.key} style={{ borderTop:"1px solid var(--border)", background: idx%2===0?"transparent":"var(--bg2)" }}>
                          <td style={{ padding:"7px 10px", color:"var(--text2)" }}>{per.label}</td>
                          <td style={{ padding:"7px 10px", color:"var(--text3)" }}>{periodoLabel(per.desde, per.hasta)}{per.esCompleto ? "" : " (parcial)"}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:600 }}>{fmt(per.monto,cur)}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", color:"var(--accent-green)", fontWeight:600 }}>{fmt(pagado,cur)}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color: saldo>0?"var(--accent-red)":"var(--accent-green)" }}>{fmt(saldo,cur)}</td>
                          <td style={{ padding:"7px 10px", textAlign:"center" }}>
                            {pagado100
                              ? <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(45,212,160,0.12)", color:"var(--accent-green)", fontWeight:700 }}>✅ PAGADO</span>
                              : pagado > 0
                              ? <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(249,200,70,0.15)", color:"#a87c0a", fontWeight:700 }}>⚡ PARCIAL</span>
                              : <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(247,86,106,0.10)", color:"var(--accent-red)", fontWeight:700 }}>⏳ PENDIENTE</span>
                            }
                          </td>
                          {!isReadOnly && (
                            <td style={{ padding:"7px 10px" }}>
                              <div style={{ display:"flex", gap:4 }}>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize:10, padding:"2px 8px" }}
                                  onClick={()=>setModalPago({ empId:emp.id, tipo:"indem", periodoKey:per.key, periodoLabel:per.label, calculado:per.monto, pagadoPrev:pagado, pagoId: pago?.id })}>
                                  {pago ? "✏️ Editar" : "+ Pago"}
                                </button>
                                {pago && <button className="btn btn-danger btn-sm" style={{ fontSize:10, padding:"2px 6px" }} onClick={()=>deletePago(emp.id,"indem",per.key)}>✕</button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"rgba(247,86,106,0.07)", fontWeight:700 }}>
                      <td colSpan={2} style={{ padding:"8px 10px", color:"var(--text)" }}>TOTAL INDEMNIZACIÓN</td>
                      <td style={{ padding:"8px 10px", textAlign:"right" }}>{fmt(emp.totalIndem,cur)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"var(--accent-green)" }}>{fmt(emp.pagadoIndem,cur)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"var(--accent-red)" }}>{fmt(emp.saldoIndem,cur)}</td>
                      <td colSpan={isReadOnly?1:2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Aguinaldo por años */}
              <div>
                <div style={{ fontWeight:700, fontSize:12, color:"var(--accent-yellow)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>
                  🎄 Aguinaldo por año — duodécimas
                </div>
                <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"var(--bg2)" }}>
                      <th style={{ padding:"6px 10px", textAlign:"left",  fontWeight:600, color:"var(--text3)" }}>Año</th>
                      <th style={{ padding:"6px 10px", textAlign:"left",  fontWeight:600, color:"var(--text3)" }}>Período</th>
                      <th style={{ padding:"6px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>Calculado</th>
                      <th style={{ padding:"6px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>Pagado</th>
                      <th style={{ padding:"6px 10px", textAlign:"right", fontWeight:600, color:"var(--text3)" }}>Saldo</th>
                      <th style={{ padding:"6px 10px", textAlign:"center",fontWeight:600, color:"var(--text3)" }}>Estado</th>
                      {!isReadOnly && <th style={{ padding:"6px 10px" }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {emp.periAguin.map((per, idx) => {
                      const pago    = emp.pagosAguin.find(p=>p.periodoKey===per.key);
                      const pagado  = pago?.monto || 0;
                      const saldo   = Math.max(0, per.monto - pagado);
                      const esProyectado = !emp.fechaBaja && per.hasta > hoy;
                      const pagado100 = pagado >= per.monto * 0.999;
                      return (
                        <tr key={per.key} style={{ borderTop:"1px solid var(--border)", background:idx%2===0?"transparent":"var(--bg2)" }}>
                          <td style={{ padding:"7px 10px", fontWeight:600, color:"var(--text)" }}>{per.anio}</td>
                          <td style={{ padding:"7px 10px", color:"var(--text3)" }}>
                            {fmtDate(per.desde)} → {fmtDate(per.hasta)}
                            {esProyectado && <span style={{ marginLeft:6, fontSize:9, color:"#4f8ef7", fontWeight:700 }}>PROYECTADO</span>}
                          </td>
                          <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:600 }}>{fmt(per.monto,cur)}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", color:"var(--accent-green)", fontWeight:600 }}>{fmt(pagado,cur)}</td>
                          <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color:saldo>0?"#a87c0a":"var(--accent-green)" }}>{fmt(saldo,cur)}</td>
                          <td style={{ padding:"7px 10px", textAlign:"center" }}>
                            {pagado100
                              ? <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(45,212,160,0.12)", color:"var(--accent-green)", fontWeight:700 }}>✅ PAGADO</span>
                              : pagado>0
                              ? <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(249,200,70,0.15)", color:"#a87c0a", fontWeight:700 }}>⚡ PARCIAL</span>
                              : esProyectado
                              ? <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(79,142,247,0.10)", color:"#4f8ef7", fontWeight:700 }}>📅 PROYECT.</span>
                              : <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(247,86,106,0.10)", color:"var(--accent-red)", fontWeight:700 }}>⏳ PENDIENTE</span>
                            }
                          </td>
                          {!isReadOnly && (
                            <td style={{ padding:"7px 10px" }}>
                              <div style={{ display:"flex", gap:4 }}>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize:10, padding:"2px 8px" }}
                                  onClick={()=>setModalPago({ empId:emp.id, tipo:"aguin", periodoKey:per.key, periodoLabel:per.label, calculado:per.monto, pagadoPrev:pagado, pagoId:pago?.id })}>
                                  {pago ? "✏️ Editar" : "+ Pago"}
                                </button>
                                {pago && <button className="btn btn-danger btn-sm" style={{ fontSize:10, padding:"2px 6px" }} onClick={()=>deletePago(emp.id,"aguin",per.key)}>✕</button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"rgba(249,200,70,0.08)", fontWeight:700 }}>
                      <td colSpan={2} style={{ padding:"8px 10px", color:"var(--text)" }}>TOTAL AGUINALDO</td>
                      <td style={{ padding:"8px 10px", textAlign:"right" }}>{fmt(emp.totalAguin,cur)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"var(--accent-green)" }}>{fmt(emp.pagadoAguin,cur)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#a87c0a" }}>{fmt(emp.saldoAguin,cur)}</td>
                      <td colSpan={isReadOnly?1:2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}

      {empleadosCalc.length > 0 && (
        <div style={{ fontSize:11, color:"var(--text3)", marginBottom:24, fontStyle:"italic", paddingLeft:4, lineHeight:1.6 }}>
          💡 <strong>Indemnización:</strong> 1 sueldo por año (o fracción) desde la fecha de ingreso. Cada período va de aniversario a aniversario.<br/>
          💡 <strong>Aguinaldo:</strong> Duodécimas desde el 1° de enero (o fecha ingreso) hasta el 31 de diciembre (o fecha baja). Activos proyectados a dic. 31. Haz clic en un trabajador para ver los períodos y registrar pagos.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 2: IMPUESTOS
      ══════════════════════════════════════════════════════ */}
      <SectionHeader title="🧾 Impuestos Previstos" />
      <div className="grid-3" style={{ gap:14, marginBottom:24 }}>
        <TaxPrevCard label="IVA" rate="13%" monto={ivaF} cur={cur} sub={`Mes actual — vence 16/${curMonth===12?1:curMonth+1}`} />
        <TaxPrevCard label="IT"  rate="3%"  monto={itF}  cur={cur} sub={`Mes actual — vence 16/${curMonth===12?1:curMonth+1}`} />
        <TaxPrevCard label="RC-IVA" rate="12.5%" monto={rcF} cur={cur} color="#a78bfa" sub={`Trimestre Q${curQ} — vence 16/${curQ*3+1>12?1:curQ*3+1}`} />
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 3: OTRAS PREVISIONES
      ══════════════════════════════════════════════════════ */}
      <SectionHeader title="📝 Otras Previsiones"
        onAdd={!isReadOnly ? ()=>setModalOtra({mode:"add",data:{...EMPTY_OTRA}}) : null}
        addLabel="+ Agregar concepto" />
      {previsionesOtras.length===0 ? <EmptySection icon="📝" text='Sin conceptos. Ej: Sueldos del mes, gastos operativos...' /> : (
        <div className="table-wrap" style={{ marginBottom:24 }}>
          <table>
            <thead><tr><th>Descripción</th><th style={{textAlign:"right"}}>Monto</th>{!isReadOnly&&<th>Acc.</th>}</tr></thead>
            <tbody>
              {previsionesOtras.map(o=>(
                <tr key={o.id}>
                  <td style={{fontWeight:500}}>{o.descripcion}</td>
                  <td style={{textAlign:"right",fontWeight:700,color:"var(--accent-red)"}}>{fmt(o.monto,cur)}</td>
                  {!isReadOnly&&<td><div className="td-actions">
                    <button className="btn btn-ghost btn-sm" onClick={()=>setModalOtra({mode:"edit",data:o})}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>deleteOtra(o.id)}>🗑️</button>
                  </div></td>}
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{fontWeight:700,background:"rgba(79,142,247,0.07)"}}>
              <td style={{paddingLeft:12}}>TOTAL</td>
              <td style={{textAlign:"right",color:"var(--accent-red)"}}>{fmt(totalOtras,cur)}</td>
              {!isReadOnly&&<td/>}
            </tr></tfoot>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 4: CHEQUES PENDIENTES
      ══════════════════════════════════════════════════════ */}
      <SectionHeader title="💳 Cheques Pendientes de Cobro"
        onAdd={!isReadOnly ? ()=>setModalCheque({mode:"add",data:{...EMPTY_CHEQUE,fechaEmision:hoy}}) : null}
        addLabel="+ Agregar cheque" />
      {chequesPendientes.length===0 ? <EmptySection icon="💳" text="Sin cheques registrados" /> : (
        <div className="table-wrap" style={{ marginBottom:24 }}>
          <table>
            <thead><tr><th>Cliente</th><th>Descripción</th><th>Emisión</th><th>Vencimiento</th><th style={{textAlign:"right"}}>Monto</th><th style={{textAlign:"center"}}>Estado</th>{!isReadOnly&&<th>Acc.</th>}</tr></thead>
            <tbody>
              {chequesPendientes.map(c=>{
                const vencido = c.fechaVencimiento && c.fechaVencimiento<hoy && !c.cobrado;
                return (
                  <tr key={c.id} style={{opacity:c.cobrado?0.55:1}}>
                    <td style={{fontWeight:600}}>{c.cliente}</td>
                    <td style={{fontSize:12}}>{c.descripcion}</td>
                    <td style={{fontSize:12}}>{c.fechaEmision?fmtDate(c.fechaEmision):"—"}</td>
                    <td style={{fontSize:12,color:vencido?"var(--accent-red)":"inherit"}}>{c.fechaVencimiento?fmtDate(c.fechaVencimiento):"—"}{vencido&&<span style={{fontSize:10,marginLeft:4,color:"var(--accent-red)"}}>VENCIDO</span>}</td>
                    <td style={{textAlign:"right",fontWeight:700,color:c.cobrado?"var(--accent-green)":"var(--text)"}}>{fmt(c.monto,cur)}</td>
                    <td style={{textAlign:"center"}}><span className={`badge badge-${c.cobrado?"green":vencido?"red":"blue"}`}>{c.cobrado?"✅ Cobrado":vencido?"🔴 Vencido":"⏳ Pendiente"}</span></td>
                    {!isReadOnly&&<td><div className="td-actions">
                      <button className="btn btn-ghost btn-sm" title={c.cobrado?"Marcar pendiente":"Marcar cobrado"} onClick={()=>marcarCobrado(c.id)}>{c.cobrado?"↩️":"✅"}</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setModalCheque({mode:"edit",data:c})}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>deleteCheque(c.id)}>🗑️</button>
                    </div></td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr style={{fontWeight:700,background:"rgba(45,212,160,0.07)"}}>
              <td colSpan={4} style={{paddingLeft:12}}>TOTAL PENDIENTE</td>
              <td style={{textAlign:"right",color:"var(--accent-green)"}}>{fmt(totalCheques,cur)}</td>
              <td colSpan={isReadOnly?1:2}/>
            </tr></tfoot>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          POSICIÓN NETA
      ══════════════════════════════════════════════════════ */}
      <SectionHeader title="⚖️ Posición Neta" />
      <div className="card" style={{ padding:24, marginBottom:32 }}>
        <LineaCalculo label="Saldo indemnizaciones pendientes"           monto={-totSaldoIndem}  cur={cur} />
        <LineaCalculo label="Saldo aguinaldos pendientes"                monto={-totSaldoAguin}  cur={cur} />
        <LineaCalculo label="Impuestos previstos (IVA + IT + RC-IVA)"   monto={-totalImp}       cur={cur} />
        <LineaCalculo label="Otras previsiones"                          monto={-totalOtras}     cur={cur} />
        <div style={{ borderTop:"2px solid var(--border)", marginTop:6, paddingTop:10 }} />
        <LineaCalculo label="TOTAL PREVISIONES (obligaciones)" monto={-totalPrev} cur={cur} bold color="var(--accent-red)" />
        <div style={{ borderTop:"1px dashed var(--border)", marginTop:8, paddingTop:10 }} />
        <LineaCalculo label="(+) Cheques pendientes de cobro" monto={totalCheques} cur={cur} color="var(--accent-green)" />
        <div style={{ borderTop:"2px solid var(--border)", marginTop:8, paddingTop:12 }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", borderRadius:12, background:(totalCheques-totalPrev)>=0?"rgba(45,212,160,0.10)":"rgba(247,86,106,0.08)", border:`2px solid ${(totalCheques-totalPrev)>=0?"rgba(45,212,160,0.4)":"rgba(247,86,106,0.35)"}` }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>💡 Posición neta: cobros vs. obligaciones</div>
            <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>Cheques pendientes − Total previsiones</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:24, fontWeight:900, color:(totalCheques-totalPrev)>=0?"var(--accent-green)":"var(--accent-red)" }}>{fmt(totalCheques-totalPrev,cur)}</div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>{(totalCheques-totalPrev)>=0?"✅ Los cobros cubren las obligaciones":"⚠️ Faltan fondos para cubrir obligaciones"}</div>
          </div>
        </div>
      </div>

      {/* ─── Modales ─────────────────────────────────────── */}
      {modalEmp    && <ModalEmpleado data={modalEmp.data} onSave={saveEmpleado} onClose={()=>setModalEmp(null)} cur={cur} />}
      {modalOtra   && <ModalOtra     data={modalOtra.data} onSave={saveOtra} onClose={()=>setModalOtra(null)} cur={cur} />}
      {modalCheque && <ModalCheque   data={modalCheque.data} onSave={saveCheque} onClose={()=>setModalCheque(null)} cur={cur} />}
      {modalPago   && <ModalPago     {...modalPago} onSave={savePago} onClose={()=>setModalPago(null)} cur={cur} />}
    </div>
  );
}

// ─── Componentes visuales ──────────────────────────────────────

function MiniStat({ label, v, c, bold }) {
  return (
    <div style={{ textAlign:"right" }}>
      <div style={{ fontSize:9, color:"var(--text3)", textTransform:"uppercase", marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:bold?800:600, color:c, fontVariantNumeric:"tabular-nums" }}>{v}</div>
    </div>
  );
}
function SumCard({ label, value, color, icon, sub }) {
  return (
    <div className="card" style={{ padding:"16px 18px", borderTop:`3px solid ${color}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <span style={{ fontSize:11, color:"var(--text3)", fontWeight:600, textTransform:"uppercase" }}>{label}</span>
        <span style={{ fontSize:20 }}>{icon}</span>
      </div>
      <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text3)", marginTop:4 }}>{sub}</div>}
    </div>
  );
}
function TaxPrevCard({ label, rate, monto, cur, sub, color="var(--accent-yellow)" }) {
  return (
    <div className="card" style={{ padding:"16px 18px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontWeight:700, color:"var(--text)" }}>{label}</span>
        <span className="badge badge-blue">{rate}</span>
      </div>
      <div style={{ fontSize:22, fontWeight:800, color }}>{fmt(monto,cur)}</div>
      <div style={{ fontSize:11, color:"var(--text3)", marginTop:4 }}>{sub}</div>
    </div>
  );
}
function SectionHeader({ title, onAdd, addLabel }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ height:1, width:20, background:"var(--border)" }} />
        <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{title}</span>
        <div style={{ height:1, width:40, background:"var(--border)" }} />
      </div>
      {onAdd && <button className="btn btn-ghost btn-sm" onClick={onAdd}>{addLabel}</button>}
    </div>
  );
}
function EmptySection({ icon, text }) {
  return <div style={{ textAlign:"center", padding:"20px 0 28px", color:"var(--text3)", fontSize:13 }}><span style={{ fontSize:24, display:"block", marginBottom:6 }}>{icon}</span>{text}</div>;
}
function LineaCalculo({ label, monto, cur, bold, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 4px", borderBottom:"1px solid var(--bg3)" }}>
      <span style={{ fontSize:13, fontWeight:bold?700:400, color:bold?"var(--text)":"var(--text2)" }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:bold?800:600, fontVariantNumeric:"tabular-nums", color: color||(monto>=0?"var(--accent-green)":"var(--accent-red)") }}>
        {monto>=0?"+":""}{fmt(monto,cur)}
      </span>
    </div>
  );
}

// ─── Modal: Registrar pago a cuenta ───────────────────────────
function ModalPago({ empId, tipo, periodoKey, periodoLabel: pLabel, calculado, pagadoPrev, onSave, onClose, cur }) {
  const [monto, setMonto] = useState(pagadoPrev || calculado);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [notas, setNotas] = useState("");
  const saldo = Math.max(0, calculado - monto);
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:460 }}>
        <div className="modal-header">
          <h2 className="modal-title">💰 Registrar Pago a Cuenta</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ padding:"10px 14px", background:"var(--bg3)", borderRadius:8, marginBottom:16, fontSize:12, color:"var(--text2)" }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>{tipo==="indem"?"📌 Indemnización":"🎄 Aguinaldo"}</div>
            <div>{pLabel}</div>
          </div>
          <div className="grid-2" style={{ gap:12, marginBottom:16 }}>
            <div style={{ background:"var(--bg3)", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"var(--text3)", marginBottom:4 }}>CALCULADO</div>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--text)" }}>{fmt(calculado,cur)}</div>
            </div>
            <div style={{ background: saldo===0?"rgba(45,212,160,0.10)":"rgba(247,86,106,0.08)", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"var(--text3)", marginBottom:4 }}>SALDO PENDIENTE</div>
              <div style={{ fontSize:16, fontWeight:800, color:saldo===0?"var(--accent-green)":"var(--accent-red)" }}>{fmt(saldo,cur)}</div>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label className="form-label">Monto Pagado ({cur})</label>
              <input className="form-input" type="number" step="0.01" min="0" value={monto} onChange={e=>setMonto(+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Pago</label>
              <input className="form-input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notas (opcional)</label>
            <input className="form-input" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: Pago parcial, cheque #123..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>onSave({ empId, tipo, periodoKey, monto, fecha, notas })}>Guardar Pago</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Empleado ────────────────────────────────────────────
function ModalEmpleado({ data, onSave, onClose, cur }) {
  const [form, setForm] = useState({ ...data });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const hoy = new Date().toISOString().split("T")[0];
  const preview = form.fechaIngreso && form.sueldo>0 ? {
    periIndem: generarPeriodosIndem(form.fechaIngreso, form.fechaBaja||null, form.sueldo),
    periAguin: generarPeriodosAguin(form.fechaIngreso, form.fechaBaja||null, form.sueldo),
  } : null;
  const totalI = preview?.periIndem.reduce((s,p)=>s+p.monto,0)||0;
  const totalA = preview?.periAguin.reduce((s,p)=>s+p.monto,0)||0;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:580 }}>
        <div className="modal-header">
          <h2 className="modal-title">👤 {data.id?"Editar":"Agregar"} Trabajador</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom:14 }}>
            <div className="form-group"><label className="form-label">Nombre completo *</label><input className="form-input" value={form.nombre} onChange={e=>f("nombre",e.target.value)} placeholder="Juan Pérez Mamani" /></div>
            <div className="form-group"><label className="form-label">CI</label><input className="form-input" value={form.ci} onChange={e=>f("ci",e.target.value)} placeholder="7654321" /></div>
          </div>
          <div className="form-row" style={{ marginBottom:14 }}>
            <div className="form-group"><label className="form-label">Cargo</label><input className="form-input" value={form.cargo} onChange={e=>f("cargo",e.target.value)} placeholder="Vendedor, Contador..." /></div>
            <div className="form-group"><label className="form-label">Sueldo Mensual ({cur})</label><input className="form-input" type="number" step="0.01" min="0" value={form.sueldo} onChange={e=>f("sueldo",+e.target.value)} /></div>
          </div>
          <div className="form-row" style={{ marginBottom:14 }}>
            <div className="form-group"><label className="form-label">Fecha de Ingreso *</label><input className="form-input" type="date" value={form.fechaIngreso} onChange={e=>f("fechaIngreso",e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Fecha de Baja (si aplica)</label><input className="form-input" type="date" value={form.fechaBaja||""} onChange={e=>f("fechaBaja",e.target.value||"")} /></div>
          </div>
          <div className="form-group" style={{ marginBottom:14 }}>
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" rows={2} value={form.notas} onChange={e=>f("notas",e.target.value)} placeholder="Observaciones..." />
          </div>
          {preview && (
            <div style={{ background:"rgba(79,142,247,0.08)", border:"1px solid rgba(79,142,247,0.25)", borderRadius:10, padding:"14px 16px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", marginBottom:10 }}>📊 Vista previa — {preview.periIndem.length} período(s) de indemnización / {preview.periAguin.length} año(s) de aguinaldo</div>
              <div className="grid-2" style={{ gap:12 }}>
                <div><div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>INDEMNIZACIÓN TOTAL</div><div style={{ fontSize:15, fontWeight:700, color:"var(--accent-red)" }}>{fmt(totalI,cur)}</div></div>
                <div><div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>AGUINALDO TOTAL</div><div style={{ fontSize:15, fontWeight:700, color:"#a87c0a" }}>{fmt(totalA,cur)}</div></div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{if(!form.nombre||!form.fechaIngreso)return alert("Nombre y fecha de ingreso son obligatorios");onSave(form);}}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function ModalOtra({ data, onSave, onClose, cur }) {
  const [form, setForm] = useState({...data});
  const SUGERENCIAS = ["Sueldos del mes","Gastos operativos","Alquiler","Servicios básicos","Mantenimiento","Publicidad","Otros gastos"];
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:440 }}>
        <div className="modal-header"><h2 className="modal-title">📝 {data.id?"Editar":"Nueva"} Previsión</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom:10 }}>
            <label className="form-label">Descripción *</label>
            <input className="form-input" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="Ej: Sueldos del mes" />
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
              {SUGERENCIAS.map(s=><button key={s} type="button" className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"2px 8px" }} onClick={()=>setForm(p=>({...p,descripcion:s}))}>{s}</button>)}
            </div>
          </div>
          <div className="form-group"><label className="form-label">Monto ({cur})</label><input className="form-input" type="number" step="0.01" min="0" value={form.monto} onChange={e=>setForm(p=>({...p,monto:+e.target.value}))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{if(!form.descripcion)return alert("Descripción obligatoria");onSave(form);}}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function ModalCheque({ data, onSave, onClose, cur }) {
  const [form, setForm] = useState({...data});
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-header"><h2 className="modal-title">💳 {data.id?"Editar":"Nuevo"} Cheque Pendiente</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-row" style={{ marginBottom:14 }}>
            <div className="form-group"><label className="form-label">Cliente *</label><input className="form-input" value={form.cliente} onChange={e=>f("cliente",e.target.value)} placeholder="Nombre del cliente" /></div>
            <div className="form-group"><label className="form-label">Monto ({cur}) *</label><input className="form-input" type="number" step="0.01" min="0" value={form.monto} onChange={e=>f("monto",+e.target.value)} /></div>
          </div>
          <div className="form-group" style={{ marginBottom:14 }}><label className="form-label">Descripción</label><input className="form-input" value={form.descripcion} onChange={e=>f("descripcion",e.target.value)} placeholder="Ej: Factura #123" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Fecha Emisión</label><input className="form-input" type="date" value={form.fechaEmision} onChange={e=>f("fechaEmision",e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Fecha Vencimiento</label><input className="form-input" type="date" value={form.fechaVencimiento} onChange={e=>f("fechaVencimiento",e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{if(!form.cliente||!form.monto)return alert("Cliente y monto obligatorios");onSave(form);}}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
