import { useState } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";
import TransactionModal from "../components/TransactionModal";
import RecurringPanel from "../components/RecurringPanel";
import { useSortableData, SortableTh } from "../components/SortableTable";


export default function Costos() {
  const { config, costos, addCosto, deleteCosto, updateCosto, isReadOnly, project } = useApp();
  const [modal, setModal] = useState(null);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(costos, "fecha", "desc");

  const fields = [
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "categoria", label: "Categoría", type: "select", options: config.categoriasCostos, required: true },
    { key: "descripcion", label: "Descripción", type: "text" },
    { key: "metodoPago", label: "Método de Pago", type: "select", options: config.metodosPago },
    { key: "costoTotal", label: "Costo Total", type: "number", required: true, step: "0.01", min: "0" },
    { key: "impuesto", label: "Impuesto (%)", type: "number", step: "0.01", min: "0" },
    { key: "notas", label: "Notas", type: "textarea" },
  ];

  const totBruto = costos.reduce((s, x) => s + (x.costoTotal||0), 0);
  const totImp = costos.reduce((s, x) => s + (x.valorImpuesto||0), 0);
  const totNeto = costos.reduce((s, x) => s + (x.totalNeto||0), 0);

  const handleSave = (form) => {
    if (modal.mode === "edit") updateCosto(modal.data.id, form);
    else addCosto(form);
    setModal(null);
  };

  const handleUseTemplate = (tpl) => {
    setModal({
      mode: "add",
      data: {
        fecha: new Date().toISOString().split("T")[0],
        categoria: tpl.categoria,
        descripcion: tpl.descripcion,
        metodoPago: tpl.metodoPago,
        impuesto: tpl.impuesto || 0,
        notas: tpl.notas || "",
        costoTotal: 0,
      },
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏭 Panel de Costos</h1>
          <p className="page-subtitle">
            Registra los costos de producción y operación del proyecto
          </p>
        </div>
      </div>

      <RecurringPanel
        type="costo"
        categorias={config.categoriasCostos}
        metodosPago={config.metodosPago}
        onUseTemplate={handleUseTemplate}
        isReadOnly={isReadOnly}
      />

      <div className="stats-row">
        <div className="stat-pill"><div className="label">Costos Brutos</div><div className="value" style={{color:"var(--accent-yellow)"}}>{fmt(totBruto, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Monto de Impuestos</div><div className="value">{fmt(totImp, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Costos Netos</div><div className="value" style={{color:"var(--accent-yellow)"}}>{fmt(totNeto, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Registros</div><div className="value">{costos.length}</div></div>
      </div>

      {!isReadOnly && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button className="btn" style={{ background: "linear-gradient(135deg,#f9c846,#e8a830)", color: "#fff" }}
            onClick={() => setModal({ mode: "add", data: { fecha: new Date().toISOString().split("T")[0], impuesto: 0 } })}>
            + Nuevo Costo
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <SortableTh label="Fecha" sortKey="fecha" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Categoría" sortKey="categoria" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th>Descripción</th>
              <th>Método Pago</th>
              <SortableTh label="Costo Total" sortKey="costoTotal" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <SortableTh label="Impuesto %" sortKey="impuesto" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <th style={{ textAlign: "right" }}>Valor Imp.</th>
              <SortableTh label="Total Neto" sortKey="totalNeto" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <th>Notas</th>
              {!isReadOnly && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={11}><div className="empty-state"><div className="icon">🏭</div><p>No hay costos registrados</p></div></td></tr>
            ) : sorted.map((item, i) => (
              <tr key={item.id}>
                <td><span className="badge badge-yellow">#{i + 1}</span></td>
                <td>{fmtDate(item.fecha)}</td>
                <td><span className="badge badge-yellow">{item.categoria}</span></td>
                <td>{item.descripcion}</td>
                <td>{item.metodoPago}</td>
                <td className="num-neutral num-col">{fmt(item.costoTotal, config.currency)}</td>
                <td className="num-col">{item.impuesto || 0}%</td>
                <td className="num-col">{fmt(item.valorImpuesto, config.currency)}</td>
                <td className="num-col" style={{ color: "var(--accent-yellow)", fontWeight: 600 }}>{fmt(item.totalNeto, config.currency)}</td>
                <td>{item.notas}</td>
                {!isReadOnly && (
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: "edit", data: item })}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => confirm("¿Eliminar costo?") && deleteCosto(item.id)}>🗑️</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <TransactionModal title={modal.mode === "edit" ? "Editar Costo" : "Nuevo Costo"} fields={fields} initial={modal.data} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
