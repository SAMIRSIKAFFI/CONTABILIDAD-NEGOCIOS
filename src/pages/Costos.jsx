import { useState } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";
import TransactionModal from "../components/TransactionModal";
import RecurringPanel from "../components/RecurringPanel";
import ExportModal from "../components/ExportModal";
import { useSortableData, SortableTh, useTableSearch, TableSearchBar, usePagination, Pagination } from "../components/SortableTable";

const PAGE_SIZE = 25;

export default function Costos() {
  const { config, costos, addCosto, deleteCosto, updateCosto, isReadOnly } = useApp();
  const [modal, setModal] = useState(null);
  const [showExport, setShowExport] = useState(false);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(costos, "fecha", "desc");
  const { filtered, search, setSearch, filterCat, setFilterCat, filterMes, setFilterMes, filterAno, setFilterAno, limpiar, hayFiltro } = useTableSearch(sorted);
  const { pageItems, page, totalPages, goTo, start, total } = usePagination(filtered, PAGE_SIZE);

  // Detectar cuentas de cualquier estructura posible en config
  const _rawCuentas = [];
  if (Array.isArray(config.cuentasBancarias)) _rawCuentas.push(...config.cuentasBancarias);
  if (config.cuentaBancaria && typeof config.cuentaBancaria === 'object') {
    const cb = config.cuentaBancaria;
    if (cb.banco || cb.id || cb.numeroCuenta) _rawCuentas.push(cb);
  }
  const _allCuentas = _rawCuentas.filter(c => c && (c.id || c.banco));
  const cuentaOpts = _allCuentas.length > 0
    ? _allCuentas.map(c => `${c.banco || "Banco"} ···· ${String(c.numeroCuenta || c.id || "").slice(-4)} | ${c.id || c.banco}`)
    : ["Sin cuentas configuradas | __none__"];

  const fields = [
    { key: "fecha",            label: "Fecha",             type: "date",    required: true },
    { key: "categoria",        label: "Categoría",         type: "select",  options: config.categoriasCostos, required: true },
    { key: "descripcion",      label: "Descripción",       type: "text" },
    { key: "metodoPago",       label: "Método de Pago",    type: "select",  options: config.metodosPago },
    { key: "cuentaBancariaId", label: `💳 Cuenta Bancaria${_allCuentas.length === 0 ? " (⚠️ Configura cuentas en Banco)" : ""}`, type: "select", options: cuentaOpts, required: true },
    { key: "costoTotal",       label: "Costo Total",       type: "number",  required: true, step: "0.01", min: "0" },
    { key: "impuesto",         label: "Impuesto (%)",      type: "number",  step: "0.01", min: "0" },
    { key: "notas",            label: "Notas",             type: "textarea" },
  ];

  const totBruto = costos.reduce((s, x) => s + (x.costoTotal || 0), 0);
  const totImp   = costos.reduce((s, x) => s + (x.valorImpuesto || 0), 0);
  const totNeto  = costos.reduce((s, x) => s + (x.totalNeto || 0), 0);

  const handleSave = (form) => {
    const raw = form.cuentaBancariaId || "";
    const realId = raw.includes("|") ? raw.split("|").pop().trim() : raw;
    const processedForm = { ...form, cuentaBancariaId: realId };
    if (modal.mode === "edit") updateCosto(modal.data.id, processedForm);
    else addCosto(processedForm);
    setModal(null);
  };

  const handleUseTemplate = (tpl) => {
    setModal({
      mode: "add",
      data: { fecha: new Date().toISOString().split("T")[0], categoria: tpl.categoria, descripcion: tpl.descripcion, metodoPago: tpl.metodoPago, impuesto: tpl.impuesto || 0, notas: tpl.notas || "", costoTotal: 0 },
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏭 Panel de Costos</h1>
          <p className="page-subtitle">Registra los costos de producción y operación del proyecto</p>
        </div>
      </div>

      <RecurringPanel type="costo" categorias={config.categoriasCostos} metodosPago={config.metodosPago} onUseTemplate={handleUseTemplate} isReadOnly={isReadOnly} />

      <div className="stats-row">
        <div className="stat-pill"><div className="label">Costos Brutos</div><div className="value" style={{ color: "var(--accent-yellow)" }}>{fmt(totBruto, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Monto de Impuestos</div><div className="value">{fmt(totImp, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Costos Netos</div><div className="value" style={{ color: "var(--accent-yellow)" }}>{fmt(totNeto, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Registros</div><div className="value">{costos.length}</div></div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <TableSearchBar search={search} onSearch={setSearch} filterCat={filterCat} onFilterCat={setFilterCat} filterMes={filterMes} onFilterMes={setFilterMes} filterAno={filterAno} onFilterAno={setFilterAno} categories={config.categoriasCostos} placeholder="Buscar..." limpiar={limpiar} hayFiltro={hayFiltro} />
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={() => setShowExport(true)}>📤 Exportar</button>
          {!isReadOnly && (
            <button className="btn" style={{ background: "linear-gradient(135deg,#f9c846,#e8a830)", color: "#fff" }}
              onClick={() => setModal({ mode: "add", data: { fecha: new Date().toISOString().split("T")[0], impuesto: 0 } })}>
              + Nuevo Costo
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <SortableTh label="Fecha"       sortKey="fecha"        currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Categoría"   sortKey="categoria"    currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th>Descripción</th>
              <th>Método Pago</th>
              <SortableTh label="Costo Total" sortKey="costoTotal"   currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <SortableTh label="Impuesto %"  sortKey="impuesto"     currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <SortableTh label="Valor Imp."  sortKey="valorImpuesto" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <SortableTh label="Total Neto"  sortKey="totalNeto"    currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <th>Notas</th>
              {!isReadOnly && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr><td colSpan={11}><div className="empty-state"><div className="icon">🏭</div><p>{search || filterCat ? "Sin resultados para la búsqueda" : "No hay costos registrados"}</p></div></td></tr>
            ) : pageItems.map((item, i) => (
              <tr key={item.id}>
                <td><span className="badge badge-yellow">#{start + i + 1}</span></td>
                <td>{fmtDate(item.fecha)}</td>
                <td><span className="badge badge-yellow">{item.categoria}</span></td>
                <td>{item.descripcion}</td>
                <td>{item.metodoPago}</td>
                <td className="num-neutral num-col">{fmt(item.costoTotal, config.currency)}</td>
                <td className="num-col" style={{ textAlign: "right" }}>{item.impuesto || 0}%</td>
                <td className="num-col" style={{ textAlign: "right" }}>{fmt(item.valorImpuesto, config.currency)}</td>
                <td className="num-col" style={{ color: "var(--accent-yellow)", fontWeight: 600, textAlign: "right" }}>{fmt(item.totalNeto, config.currency)}</td>
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

      <Pagination page={page} totalPages={totalPages} goTo={goTo} total={total} pageSize={PAGE_SIZE} start={start} />

      {modal && <TransactionModal title={modal.mode === "edit" ? "Editar Costo" : "Nuevo Costo"} fields={fields} initial={modal.data} onSave={handleSave} onClose={() => setModal(null)} />}
      {showExport && <ExportModal tipo="costo" data={costos} categorias={config.categoriasCostos} metodosPago={config.metodosPago} currency={config.currency} onClose={() => setShowExport(false)} />}
    </div>
  );
}
