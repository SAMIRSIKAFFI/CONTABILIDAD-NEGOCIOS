import { useState, useRef } from "react";
import { useApp } from "../context/AppContext";

export default function ImportExport() {
  const { exportData, importFromBackup, importData, clearAllData, repairMonthYear, ingresos, gastos, costos, isReadOnly } = useApp();
  const [msg, setMsg] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvType, setCsvType] = useState("ingresos");
  const [csvMapping, setCsvMapping] = useState({});
  const [csvRows, setCsvRows] = useState([]);
  const [amountGuessed, setAmountGuessed] = useState(false); // true si el monto se adivinó por heurística, no por nombre de columna
  const fileRef = useRef();
  const backupRef = useRef();

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  const handleBackupImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const ok = await importFromBackup(ev.target.result);
      ok ? showMsg("✅ Backup restaurado correctamente") : showMsg("❌ Archivo inválido", false);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const parseCSV = (text) => {
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n").filter(l => l.trim() !== "");
    if (lines.length < 2) return { headers: [], rows: [] };
    const firstLine = lines[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    let sep = ",";
    if (semis > commas && semis >= tabs) sep = ";";
    else if (tabs > commas && tabs >= semis) sep = "\t";

    const parseLine = (line) => {
      const result = []; let current = ""; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
        else if (ch === sep && !inQuotes) { result.push(current.trim()); current = ""; }
        else current += ch;
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.replace(/^["']|["']$/g, "").trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = parseLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^["']|["']$/g, "").trim(); });
      return obj;
    }).filter(row => Object.values(row).some(v => v !== ""));

    return { headers, rows };
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev.target.result);
        if (headers.length === 0) { showMsg("❌ No se pudo leer el archivo. Asegúrate de que sea CSV.", false); return; }
        setCsvRows(rows);
        setCsvPreview({ headers, sample: rows.slice(0, 5) });

        const autoMap = {};
        const fieldAliases = {
          fecha: ["fecha","date","dia","day","f.","fec"],
          categoria: ["categoria","category","cat","tipo","rubro","clase"],
          descripcion: ["descripcion","description","detalle","concepto","desc"],
          metodoPago: ["metodopago","metodo","payment","pago","forma de pago","formapago","medio"],
          ingresoTotal: ["ingresototal","ingreso","monto","amount","total","importe","valor","price","precio","ingr"],
          gastoTotal: ["gastototal","gasto","monto","amount","total","importe","valor","price","precio","gast"],
          costoTotal: ["costototal","costo","monto","amount","total","importe","valor","price","precio","cost"],
          impuesto: ["impuesto","tax","iva","impuestos","tasa"],
          notas: ["notas","notes","nota","observaciones","obs","comentario","comment"],
        };
        headers.forEach(h => {
          const hClean = h.replace(/\s/g, "").toLowerCase();
          Object.entries(fieldAliases).forEach(([field, aliases]) => {
            if (!autoMap[field] && aliases.some(a => hClean.includes(a) || a.includes(hClean))) autoMap[field] = h;
          });
        });

        const amtField = csvType === "ingresos" ? "ingresoTotal" : csvType === "gastos" ? "gastoTotal" : "costoTotal";
        let guessed = false;
        if (!autoMap[amtField] && rows.length > 0) {
          // No hubo columna cuyo nombre coincidiera con un alias conocido de "monto" —
          // se elige la columna numérica con mayor suma como mejor intento, pero es una
          // adivinanza: podría ser, por ejemplo, un número de factura en vez de un monto.
          let bestCol = null, bestSum = 0;
          headers.forEach(h => {
            const sum = rows.reduce((s, r) => s + (parseFloat((r[h] || "").replace(/[^0-9.-]/g, "")) || 0), 0);
            if (sum > bestSum) { bestSum = sum; bestCol = h; }
          });
          if (bestCol) { autoMap[amtField] = bestCol; guessed = true; }
        }

        setAmountGuessed(guessed);
        setCsvMapping(autoMap);
        showMsg(`✅ Archivo cargado: ${rows.length} filas, ${headers.length} columnas detectadas`);
      } catch (err) {
        showMsg("❌ Error al leer el archivo: " + err.message, false);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const applyImport = async () => {
    if (!csvRows.length) { showMsg("❌ No hay datos cargados", false); return; }
    const amountField = csvType === "ingresos" ? "ingresoTotal" : csvType === "gastos" ? "gastoTotal" : "costoTotal";

    const mapped = csvRows.map(row => {
      const obj = { impuesto: 0, notas: "", descripcion: "", metodoPago: "Efectivo" };
      Object.entries(csvMapping).forEach(([field, col]) => {
        if (!col) return;
        let val = row[col] !== undefined ? row[col] : "";
        if (["ingresoTotal","gastoTotal","costoTotal","impuesto"].includes(field)) {
          val = parseFloat(String(val).replace(/[^0-9.,\-]/g, "").replace(",", ".")) || 0;
        }
        obj[field] = val;
      });
      if (!obj.fecha || obj.fecha === "") obj.fecha = new Date().toISOString().split("T")[0];
      if (!obj.categoria || obj.categoria === "") obj.categoria = "Importado";
      if (isNaN(obj[amountField])) obj[amountField] = 0;
      return obj;
    });

    const valid = mapped.filter(r => r[amountField] > 0);
    if (valid.length === 0) { showMsg(`❌ No se encontraron filas con montos válidos.`, false); return; }

    const ok = await importData(csvType, valid);
    ok ? showMsg(`✅ ${valid.length} registros importados exitosamente en ${csvType}`) : showMsg("❌ Error al importar", false);
    setCsvPreview(null); setCsvRows([]); setCsvMapping({});
  };

  const FIELDS = {
    ingresos: ["fecha","categoria","descripcion","metodoPago","ingresoTotal","impuesto","notas"],
    gastos:   ["fecha","categoria","descripcion","metodoPago","gastoTotal","impuesto","notas"],
    costos:   ["fecha","categoria","descripcion","metodoPago","costoTotal","impuesto","notas"],
  };

  const downloadTemplate = () => {
    const fields = FIELDS[csvType];
    const examples = {
      ingresos: "2024-08-15,Ventas,Venta producto A,Efectivo,1500,13,Primer venta\n2024-08-16,Servicios,Consultoría,Transferencia,800,0,Cliente nuevo",
      gastos:   "2024-08-15,Alquiler,Pago agosto,Transferencia,800,0,Mensual\n2024-08-16,Sueldos,Sueldo empleado,Transferencia,1200,0,",
      costos:   "2024-08-15,Materia Prima,Compra insumos,Efectivo,500,0,\n2024-08-16,Producción,Maquinaria,Transferencia,300,0,",
    };
    const csv = "\uFEFF" + fields.join(",") + "\n" + examples[csvType];
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `plantilla_${csvType}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">📤 Importar / Exportar</h1><p className="page-subtitle">Migra datos desde Excel, respalda y restaura tu información</p></div></div>

      {msg && (
        <div style={{ padding: "12px 18px", borderRadius: 10, marginBottom: 20, background: msg.ok ? "rgba(45,212,160,0.12)" : "rgba(247,86,106,0.12)", border: `1px solid ${msg.ok ? "rgba(45,212,160,0.4)" : "rgba(247,86,106,0.4)"}`, color: msg.ok ? "#0d9e72" : "#d63348", fontWeight: 600, fontSize: 14 }}>{msg.text}</div>
      )}

      <div className="stats-row" style={{ marginBottom: 24 }}>
        <div className="stat-pill"><div className="label">Ingresos</div><div className="value green">{ingresos.length} registros</div></div>
        <div className="stat-pill"><div className="label">Gastos</div><div className="value red">{gastos.length} registros</div></div>
        <div className="stat-pill"><div className="label">Costos</div><div className="value" style={{color:"var(--accent-yellow)"}}>{costos.length} registros</div></div>
        <div className="stat-pill"><div className="label">Total</div><div className="value blue">{ingresos.length + gastos.length + costos.length}</div></div>
      </div>

      {isReadOnly ? (
        <div style={{ padding: 20, background: "rgba(249,200,70,0.1)", border: "1px solid rgba(249,200,70,0.3)", borderRadius: 10, color: "#a87c0a" }}>
          🔒 Tienes acceso de solo lectura. No puedes importar ni exportar datos.
        </div>
      ) : (
        <div className="grid-2" style={{ gap: 20 }}>
          <div className="card">
            <div className="section-title">💾 Respaldo y Restauración</div>
            <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 18, lineHeight: 1.7 }}>Exporta todos tus datos a JSON para guardar o transferir. Para restaurar, sube ese mismo archivo.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center", padding:12 }} onClick={exportData}>⬇️ Descargar Backup Completo (.json)</button>
              <button className="btn btn-ghost" style={{ width:"100%", justifyContent:"center", padding:12 }} onClick={() => backupRef.current.click()}>⬆️ Restaurar desde Backup (.json)</button>
              <input ref={backupRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleBackupImport} />
            </div>
            <hr className="divider" />
            <p style={{ fontSize:12, color:"var(--text3)" }}>⚠️ Los datos se guardan en la nube (Supabase). El backup sirve para transferir entre proyectos.</p>
          </div>

          <div className="card">
            <div className="section-title">📊 Importar desde Excel / CSV</div>
            <p style={{ color:"var(--text2)", fontSize:13, marginBottom:14, lineHeight:1.7 }}>Exporta tu planilla Excel como CSV y súbela aquí. <strong>Primero descarga la plantilla</strong> para ver el formato.</p>

            <div className="form-group" style={{ marginBottom:14 }}>
              <label className="form-label">Tipo de datos</label>
              <select className="form-select" value={csvType} onChange={e => { setCsvType(e.target.value); setCsvPreview(null); setCsvRows([]); }}>
                <option value="ingresos">💰 Ingresos</option>
                <option value="gastos">💸 Gastos</option>
                <option value="costos">🏭 Costos</option>
              </select>
            </div>

            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <button className="btn btn-ghost" style={{ flex:1, justifyContent:"center" }} onClick={downloadTemplate}>📥 Descargar Plantilla CSV</button>
              <button className="btn btn-primary" style={{ flex:1, justifyContent:"center" }} onClick={() => fileRef.current.click()}>📂 Subir mi CSV</button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={handleCSVUpload} />

            {csvPreview && csvPreview.headers.length > 0 && (
              <div style={{ marginTop:16 }}>
                <div className="section-title">Mapeo de Columnas</div>
                <p style={{ fontSize:12, color:"var(--text2)", marginBottom:12 }}>Columnas encontradas: <strong style={{color:"var(--accent)"}}>{csvPreview.headers.join(" | ")}</strong></p>
                {amountGuessed && (
                  <div style={{ padding:"8px 12px", background:"rgba(249,200,70,0.14)", border:"1px solid rgba(249,200,70,0.35)", borderRadius:8, marginBottom:12, color:"#a87c0a", fontSize:12 }}>
                    ⚠️ No encontré una columna claramente llamada "monto" — elegí <strong>{csvMapping[csvType === "ingresos" ? "ingresoTotal" : csvType === "gastos" ? "gastoTotal" : "costoTotal"]}</strong> por ser la columna numérica con la suma más alta. Verifica en la vista previa de abajo que sea realmente el monto y no, por ejemplo, un número de factura.
                  </div>
                )}
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                  {FIELDS[csvType].map(field => {
                    const amtField = csvType === "ingresos" ? "ingresoTotal" : csvType === "gastos" ? "gastoTotal" : "costoTotal";
                    const isGuessedAmount = amountGuessed && field === amtField;
                    return (
                    <div key={field} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ width:110, fontSize:12, color:"var(--text2)", fontWeight:700, flexShrink:0 }}>{field}</span>
                      <select className="form-select" style={{ flex:1, fontSize:12, padding:"5px 8px", borderColor: isGuessedAmount ? "#a87c0a" : undefined }} value={csvMapping[field] || ""} onChange={e => setCsvMapping(prev => ({ ...prev, [field]: e.target.value }))}>
                        <option value="">-- no mapear --</option>
                        {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      {isGuessedAmount ? <span style={{color:"#a87c0a", fontSize:16}} title="Detectado por adivinanza, verifica">⚠️</span> : csvMapping[field] && <span style={{color:"var(--accent-green)", fontSize:16}}>✓</span>}
                    </div>
                  );})}
                </div>
                <p style={{ fontSize:12, color:"var(--text3)", marginBottom:8 }}>Vista previa ({csvPreview.sample.length} de {csvRows.length} filas):</p>
                <div className="table-wrap" style={{ marginBottom:16, maxHeight:200, overflowY:"auto" }}>
                  <table>
                    <thead><tr>{csvPreview.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{csvPreview.sample.map((row,i) => (<tr key={i}>{csvPreview.headers.map(h => <td key={h}>{row[h]}</td>)}</tr>))}</tbody>
                  </table>
                </div>
                <button className="btn btn-success" style={{ width:"100%", justifyContent:"center", padding:14, fontSize:15 }} onClick={applyImport}>✅ Importar {csvRows.length} registros como {csvType}</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop:20 }}>
        <div className="section-title">📋 Cómo exportar desde Excel paso a paso</div>
        <div className="grid-2" style={{ gap:20 }}>
          <div>
            <p style={{ fontWeight:700, color:"var(--text)", marginBottom:10, fontSize:14 }}>Desde Excel (Windows):</p>
            <ol style={{ paddingLeft:18, color:"var(--text2)", fontSize:13, lineHeight:2.2 }}>
              <li>Abre tu archivo Excel</li><li>Ve a la hoja de Ingresos (o Gastos/Costos)</li>
              <li>Clic en Archivo → Guardar Como</li><li>Selecciona CSV UTF-8 (delimitado por comas)</li>
              <li>Guarda y sube el .csv aquí</li>
            </ol>
          </div>
          <div>
            <p style={{ fontWeight:700, color:"var(--text)", marginBottom:10, fontSize:14 }}>Desde Google Sheets:</p>
            <ol style={{ paddingLeft:18, color:"var(--text2)", fontSize:13, lineHeight:2.2 }}>
              <li>Abre tu hoja en Google Sheets</li><li>Selecciona la hoja de Ingresos</li>
              <li>Archivo → Descargar → CSV</li><li>Sube el archivo descargado aquí</li>
            </ol>
          </div>
        </div>
      </div>

      {!isReadOnly && (
        <div className="card" style={{ marginTop:20, borderColor:"rgba(79,142,247,0.3)" }}>
          <div className="section-title" style={{ color:"var(--accent)" }}>🔧 Mantenimiento</div>
          <p style={{ color:"var(--text2)", fontSize:13, marginBottom:14, lineHeight:1.6 }}>
            Si un registro aparece en el mes equivocado dentro de los resúmenes (Mensual, Anual, Flujo) pero su fecha es correcta en la tabla de Ingresos/Gastos, usa esta herramienta para recalcular automáticamente el mes y año de todos los registros según su fecha real.
          </p>
          <button className="btn btn-ghost" disabled={repairing}
            onClick={async () => {
              setRepairing(true);
              showMsg("⏳ Reparando registros, espera un momento...");
              try {
                const result = await repairMonthYear();
                if (result.error) {
                  showMsg(`❌ Error: ${result.message || "No se pudo completar"}${result.errorCount ? ` (${result.errorCount} fallos)` : ""}`, false);
                } else {
                  showMsg(result.fixed > 0 ? `✅ ${result.fixed} registros corregidos` : "✅ Todo está correcto, no se encontraron registros con mes/año desincronizado");
                }
              } catch (err) {
                showMsg(`❌ Error inesperado: ${err.message}`, false);
              } finally {
                setRepairing(false);
              }
            }}>
            {repairing ? "⏳ Reparando..." : "🔧 Reparar Mes/Año de todos los registros"}
          </button>
        </div>
      )}

      {!isReadOnly && (
        <div className="card" style={{ marginTop:20, borderColor:"rgba(247,86,106,0.3)" }}>
          <div className="section-title" style={{ color:"var(--accent)" }}>🔧 Mantenimiento</div>
          <p style={{ color:"var(--text2)", fontSize:13, marginBottom:14, lineHeight:1.6 }}>
            Si un registro aparece en el mes equivocado en los resúmenes (Mensual, Anual, Flujo) pero su fecha es correcta en Ingresos/Gastos, usa esta herramienta para recalcular mes y año de todos los registros.
          </p>
          <button className="btn btn-ghost" disabled={repairing}
            onClick={async () => {
              setRepairing(true);
              showMsg("⏳ Reparando registros...");
              try {
                const result = await repairMonthYear();
                result.error
                  ? showMsg(`❌ Error: ${result.errorCount} registros fallaron`, false)
                  : showMsg(result.fixed > 0 ? `✅ ${result.fixed} registros corregidos` : "✅ Todo correcto, no hay registros con mes/año desincronizado");
              } catch(err) {
                showMsg(`❌ Error inesperado: ${err.message}`, false);
              } finally {
                setRepairing(false);
              }
            }}>
            {repairing ? "⏳ Reparando..." : "🔧 Reparar Mes/Año de todos los registros"}
          </button>
        </div>
      )}

      {!isReadOnly && (
        <div className="card" style={{ marginTop:20, borderColor:"rgba(247,86,106,0.3)" }}>
          <div className="section-title" style={{ color:"var(--accent-red)" }}>⚠️ Zona de Peligro</div>
          <p style={{ color:"var(--text2)", fontSize:13, marginBottom:14 }}>Elimina todos los registros. La configuración se mantiene. No se puede deshacer.</p>
          <button className="btn btn-danger" onClick={async () => { if (confirm("¿Seguro? Se eliminarán TODOS los registros. No se puede deshacer.")) { await clearAllData(); showMsg("🗑️ Todos los registros eliminados"); } }}>
            🗑️ Borrar todos los registros
          </button>
        </div>
      )}
    </div>
  );
}
