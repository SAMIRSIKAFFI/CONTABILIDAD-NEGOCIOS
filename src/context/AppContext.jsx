import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

const AppContext = createContext(null)
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2) }

function buildPeriods(startMonth, startYear, count = 12) {
  const periods = []
  let m = startMonth - 1, y = startYear
  for (let i = 0; i < count; i++) {
    periods.push({ month: m+1, year: y, label: `${MONTHS_ES[m]} ${y}`, key: `${y}-${String(m+1).padStart(2,'0')}` })
    m++; if (m > 11) { m = 0; y++ }
  }
  return periods
}

function loadLocal(key, def) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def } }
function saveLocal(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

const CONFIG_DEFAULTS = {
  startMonth: new Date().getMonth() + 1, startYear: new Date().getFullYear(),
  currency: 'Bs', annualGoal: 0,
  tasaIVA: 13, tasaIT: 3, tasaRCIVA: 12.5,
  categoriasIngresos: ['Ventas','Servicios','Otros'],
  categoriasGastos: ['Alquiler','Sueldos','Marketing','Servicios Públicos','Otros'],
  categoriasCostos: ['Materia Prima','Producción','Logística','Otros'],
  metodosPago: ['Efectivo','Tarjeta','Transferencia','Cheque'],
  cuentaBancaria:    { activa: false, banco: '', numeroCuenta: '', tipoCuenta: 'Cuenta Corriente', saldoInicial: 0, fechaSaldoInicial: '', metodosVinculados: [] },
  personal:          [],
  previsionesOtras:  [],
  chequesPendientes: [],
}

export function AppProvider({ children, project }) {
  const { isReadOnly } = useAuth()
  const projectId = project?.id
  const storageKey = `cn_${projectId}`

  const [theme, setThemeState] = useState(() => loadLocal('cn_theme', 'light'))
  const [config, setConfigState] = useState(() => ({ ...CONFIG_DEFAULTS, ...loadLocal(`${storageKey}_config`, {}) }))
  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [costos, setCostos] = useState([])
  const [presupuesto, setPresupuesto] = useState({})
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => { if (!projectId || projectId === '__new__') { setLoadingData(false); return }; fetchProjectData() }, [projectId])
  useEffect(() => { saveLocal(`${storageKey}_config`, config) }, [config])
  useEffect(() => { saveLocal('cn_theme', theme) }, [theme])

  const setTheme = (t) => setThemeState(t)

  const fetchProjectData = async () => {
    setLoadingData(true)
    const [ing, gas, cos, pres] = await Promise.all([
      supabase.from('transactions').select('*').eq('project_id', projectId).eq('type','ingreso').order('fecha'),
      supabase.from('transactions').select('*').eq('project_id', projectId).eq('type','gasto').order('fecha'),
      supabase.from('transactions').select('*').eq('project_id', projectId).eq('type','costo').order('fecha'),
      supabase.from('project_config').select('*').eq('project_id', projectId).single(),
    ])
    if (ing.data) setIngresos(ing.data)
    if (gas.data) setGastos(gas.data)
    if (cos.data) setCostos(cos.data)
    if (pres.data?.config) { setConfigState(prev => ({ ...CONFIG_DEFAULTS, ...prev, ...pres.data.config })); setPresupuesto(pres.data.presupuesto || {}) }
    setLoadingData(false)
  }

  const saveConfig = async (newConfig) => {
    setConfigState(newConfig)
    const { error } = await supabase.from('project_config').upsert({ project_id: projectId, config: newConfig, presupuesto })
    if (error) toast.error('Error al guardar la configuración')
  }

  const setConfig = useCallback((val) => {
    const newConfig = typeof val === 'function' ? val(config) : val
    saveConfig(newConfig)
  }, [config, projectId])

  const periods = buildPeriods(config.startMonth, config.startYear, 12)

  const addTransaction = async (type, item, amountKey) => {
    if (isReadOnly) return
    const date = new Date(item.fecha)
    const amount = item[amountKey] || 0
    const valorImpuesto = item.impuesto > 0 ? Math.round(amount * item.impuesto) / 100 : 0
    const record = { ...item, id: generateId(), project_id: projectId, type, month: date.getMonth() + 1, year: date.getFullYear(), valorImpuesto, totalNeto: Math.round((amount - valorImpuesto) * 100) / 100 }
    const { error } = await supabase.from('transactions').insert(record)
    if (!error) {
      if (type==='ingreso') setIngresos(p => [...p, record])
      else if (type==='gasto') setGastos(p => [...p, record])
      else setCostos(p => [...p, record])
      toast.success('Registro guardado correctamente')
    } else { toast.error(`Error al guardar: ${error.message}`) }
  }

  const updateTransaction = async (type, id, data, amountKey) => {
    if (isReadOnly) return
    const date = new Date(data.fecha)
    const amount = data[amountKey] || 0
    const valorImpuesto = data.impuesto > 0 ? Math.round(amount * data.impuesto) / 100 : 0
    const updated = { ...data, id, project_id: projectId, type, month: date.getMonth()+1, year: date.getFullYear(), valorImpuesto, totalNeto: Math.round((amount - valorImpuesto)*100)/100 }
    const { error } = await supabase.from('transactions').update(updated).eq('id', id)
    if (!error) {
      const setter = type==='ingreso' ? setIngresos : type==='gasto' ? setGastos : setCostos
      setter(p => p.map(x => x.id===id ? updated : x))
      toast.success('Registro actualizado')
    } else { toast.error(`Error al actualizar: ${error.message}`) }
  }

  const deleteTransaction = async (type, id) => {
    if (isReadOnly) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) {
      const setter = type==='ingreso' ? setIngresos : type==='gasto' ? setGastos : setCostos
      setter(p => p.filter(x => x.id !== id))
      toast.success('Registro eliminado')
    } else { toast.error(`Error al eliminar: ${error.message}`) }
  }

  const addIngreso = useCallback((item) => addTransaction('ingreso', item, 'ingresoTotal'), [projectId, isReadOnly])
  const updateIngreso = useCallback((id, data) => updateTransaction('ingreso', id, data, 'ingresoTotal'), [projectId, isReadOnly])
  const deleteIngreso = useCallback((id) => deleteTransaction('ingreso', id), [projectId, isReadOnly])
  const addGasto = useCallback((item) => addTransaction('gasto', item, 'gastoTotal'), [projectId, isReadOnly])
  const updateGasto = useCallback((id, data) => updateTransaction('gasto', id, data, 'gastoTotal'), [projectId, isReadOnly])
  const deleteGasto = useCallback((id) => deleteTransaction('gasto', id), [projectId, isReadOnly])
  const addCosto = useCallback((item) => addTransaction('costo', item, 'costoTotal'), [projectId, isReadOnly])
  const updateCosto = useCallback((id, data) => updateTransaction('costo', id, data, 'costoTotal'), [projectId, isReadOnly])
  const deleteCosto = useCallback((id) => deleteTransaction('costo', id), [projectId, isReadOnly])

  const updatePresupuesto = useCallback(async (type, categoria, periodKey, value) => {
    const newPres = { ...presupuesto, [type]: { ...(presupuesto[type]||{}), [categoria]: { ...((presupuesto[type]||{})[categoria]||{}), [periodKey]: value } } }
    setPresupuesto(newPres)
    await supabase.from('project_config').upsert({ project_id: projectId, config, presupuesto: newPres })
  }, [presupuesto, config, projectId])

  const exportData = useCallback(() => {
    const data = { config, ingresos, gastos, costos, presupuesto, project: project?.name, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${project?.name || 'backup'}_${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Backup exportado correctamente')
  }, [config, ingresos, gastos, costos, presupuesto])

  const importData = useCallback(async (type, rows) => {
    if (isReadOnly) return false
    const amountKey = type==='ingresos' ? 'ingresoTotal' : type==='gastos' ? 'gastoTotal' : 'costoTotal'
    const dbType = type==='ingresos' ? 'ingreso' : type==='gastos' ? 'gasto' : 'costo'
    const processed = rows.map(item => {
      const date = new Date(item.fecha); const amount = item[amountKey] || 0
      const valorImpuesto = item.impuesto > 0 ? Math.round(amount * item.impuesto) / 100 : 0
      return { ...item, id: generateId(), project_id: projectId, type: dbType, month: isNaN(date)?1:date.getMonth()+1, year: isNaN(date)?new Date().getFullYear():date.getFullYear(), valorImpuesto, totalNeto: Math.round((amount-valorImpuesto)*100)/100 }
    })
    const { error } = await supabase.from('transactions').insert(processed)
    if (!error) {
      if (type==='ingresos') setIngresos(p => [...p, ...processed])
      else if (type==='gastos') setGastos(p => [...p, ...processed])
      else setCostos(p => [...p, ...processed])
      toast.success(`${processed.length} registros importados`)
    } else { toast.error(`Error al importar: ${error.message}`) }
    return !error
  }, [projectId])

  const importFromBackup = useCallback(async (jsonData) => {
    try {
      const data = JSON.parse(jsonData)
      if (data.config) await saveConfig(data.config)
      const proc = (arr, type) => arr.map(item => ({ ...item, id: generateId(), project_id: projectId, type }))
      if (data.ingresos?.length) { const r = proc(data.ingresos,'ingreso'); await supabase.from('transactions').insert(r); setIngresos(r) }
      if (data.gastos?.length) { const r = proc(data.gastos,'gasto'); await supabase.from('transactions').insert(r); setGastos(r) }
      if (data.costos?.length) { const r = proc(data.costos,'costo'); await supabase.from('transactions').insert(r); setCostos(r) }
      toast.success('Backup restaurado correctamente')
      return true
    } catch { toast.error('Error al restaurar el backup'); return false }
  }, [projectId])

  const clearAllData = useCallback(async () => {
    if (isReadOnly) return
    const { error } = await supabase.from('transactions').delete().eq('project_id', projectId)
    if (!error) { setIngresos([]); setGastos([]); setCostos([]); toast.success('Todos los datos fueron eliminados') }
    else { toast.error(`Error: ${error.message}`) }
  }, [projectId])

  const [templates, setTemplates] = useState([])
  useEffect(() => { if (!projectId || projectId === '__new__') return; fetchTemplates() }, [projectId])

  const fetchTemplates = async () => {
    const { data } = await supabase.from('recurring_templates').select('*').eq('project_id', projectId).eq('active', true).order('created_at')
    if (data) setTemplates(data)
  }

  const addTemplate = useCallback(async (tpl) => {
    if (isReadOnly) return
    const record = { ...tpl, id: generateId(), project_id: projectId, active: true }
    const { error } = await supabase.from('recurring_templates').insert(record)
    if (!error) { setTemplates(prev => [...prev, record]); toast.success('Plantilla creada') }
    else { toast.error(`Error: ${error.message}`) }
  }, [projectId, isReadOnly])

  const updateTemplate = useCallback(async (id, data) => {
    if (isReadOnly) return
    const { error } = await supabase.from('recurring_templates').update(data).eq('id', id)
    if (!error) { setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t)); toast.success('Plantilla actualizada') }
    else { toast.error(`Error: ${error.message}`) }
  }, [isReadOnly])

  const deleteTemplate = useCallback(async (id) => {
    if (isReadOnly) return
    const { error } = await supabase.from('recurring_templates').update({ active: false }).eq('id', id)
    if (!error) { setTemplates(prev => prev.filter(t => t.id !== id)); toast.success('Plantilla eliminada') }
    else { toast.error(`Error: ${error.message}`) }
  }, [isReadOnly])

  const getPendingTemplates = useCallback((type, month, year) => {
    const typeMap = { ingreso: ingresos, gasto: gastos, costo: costos }
    const records = typeMap[type] || []
    const usedThisMonth = new Set(records.filter(r => r.month === month && r.year === year).map(r => `${r.categoria}|${r.descripcion}`))
    return templates.filter(t => t.type === type).filter(t => !usedThisMonth.has(`${t.categoria}|${t.descripcion}`))
  }, [templates, ingresos, gastos, costos])

  const [taxPayments, setTaxPayments] = useState([])
  useEffect(() => { if (!projectId || projectId === '__new__') return; fetchTaxPayments() }, [projectId])

  const fetchTaxPayments = async () => {
    const { data } = await supabase.from('tax_payments').select('*').eq('project_id', projectId)
    if (data) setTaxPayments(data)
  }

  const saveTaxPayment = useCallback(async (taxType, periodKey, realPaid, paidDate, notes) => {
    if (isReadOnly) return
    const existing = taxPayments.find(t => t.tax_type === taxType && t.period_key === periodKey)
    const record = { id: existing?.id || generateId(), project_id: projectId, tax_type: taxType, period_key: periodKey, real_paid: realPaid, paid_date: paidDate || null, notes: notes || '' }
    const { error } = await supabase.from('tax_payments').upsert(record, { onConflict: 'project_id,tax_type,period_key' })
    if (!error) {
      setTaxPayments(prev => { const filtered = prev.filter(t => !(t.tax_type === taxType && t.period_key === periodKey)); return [...filtered, record] })
      toast.success('Pago de impuesto registrado')
    } else { toast.error(`Error: ${error.message}`) }
    return !error
  }, [projectId, isReadOnly, taxPayments])

  const getTaxPayment = useCallback((taxType, periodKey) => taxPayments.find(t => t.tax_type === taxType && t.period_key === periodKey), [taxPayments])

  const getTaxForecast = useCallback((taxType, month, year) => {
    const RATES = { iva: (config.tasaIVA ?? 13) / 100, it: (config.tasaIT ?? 3) / 100, rciva: (config.tasaRCIVA ?? 12.5) / 100 }
    const grossIncome = ingresos.filter(x => x.month === month && x.year === year).reduce((s, x) => s + (x.ingresoTotal || 0), 0)
    return grossIncome * (RATES[taxType] || 0)
  }, [ingresos, config.tasaIVA, config.tasaIT, config.tasaRCIVA])

  const getQuarterTaxForecast = useCallback((taxType, quarterKey) => {
    const [yearStr, qStr] = quarterKey.split('-Q')
    const year = parseInt(yearStr); const q = parseInt(qStr)
    const months = [(q-1)*3 + 1, (q-1)*3 + 2, (q-1)*3 + 3]
    return months.reduce((sum, m) => sum + getTaxForecast(taxType, m, year), 0)
  }, [getTaxForecast])

  const getIngresosPorPeriodo = useCallback((month, year) => ingresos.filter(x => x.month===month && x.year===year), [ingresos])
  const getGastosPorPeriodo = useCallback((month, year) => gastos.filter(x => x.month===month && x.year===year), [gastos])
  const getCostosPorPeriodo = useCallback((month, year) => costos.filter(x => x.month===month && x.year===year), [costos])

  const getTotalesPorPeriodo = useCallback((month, year) => {
    const ing = getIngresosPorPeriodo(month, year), gas = getGastosPorPeriodo(month, year), cos = getCostosPorPeriodo(month, year)
    const ingresosBrutos    = ing.reduce((s,x) => s+(x.ingresoTotal||0), 0)
    const retencionIngresos = ing.reduce((s,x) => s+(x.valorImpuesto||0), 0)
    const ingresosNetos     = ing.reduce((s,x) => s+(x.totalNeto||0), 0)
    const gastosTotales     = gas.reduce((s,x) => s+(x.totalNeto||0), 0)
    const costosTotales     = cos.reduce((s,x) => s+(x.totalNeto||0), 0)
    // Ganancia operativa = Ingresos Brutos - Gastos - Costos (impuestos son obligación aparte)
    const ganancia          = ingresosBrutos - gastosTotales - costosTotales
    // Ganancia neta = después de retención de impuestos sobre ingresos
    const gananciaNeta      = ingresosNetos - gastosTotales - costosTotales
    return { ingresosBrutos, retencionIngresos, ingresosNetos, gastosTotales, costosTotales, ganancia, gananciaNeta, impuestosIngresos: retencionIngresos, impuestosGastos: gas.reduce((s,x)=>s+(x.valorImpuesto||0),0) }
  }, [getIngresosPorPeriodo, getGastosPorPeriodo, getCostosPorPeriodo])

  return (
    <AppContext.Provider value={{
      config, setConfig, theme, setTheme, periods, loadingData, project, isReadOnly,
      ingresos, addIngreso, deleteIngreso, updateIngreso,
      gastos, addGasto, deleteGasto, updateGasto,
      costos, addCosto, deleteCosto, updateCosto,
      presupuesto, updatePresupuesto,
      importData, exportData, importFromBackup, clearAllData,
      templates, addTemplate, updateTemplate, deleteTemplate, getPendingTemplates,
      taxPayments, saveTaxPayment, getTaxPayment, getTaxForecast, getQuarterTaxForecast,
      getIngresosPorPeriodo, getGastosPorPeriodo, getCostosPorPeriodo, getTotalesPorPeriodo,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
