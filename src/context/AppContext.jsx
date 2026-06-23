import { createContext, useContext, useState, useCallback, useEffect } from 'react'
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

export function AppProvider({ children, project }) {
  const { isReadOnly } = useAuth()
  const projectId = project?.id
  const storageKey = `cn_${projectId}`

  const [theme, setThemeState] = useState(() => loadLocal('cn_theme', 'light'))
  const [config, setConfigState] = useState(() => loadLocal(`${storageKey}_config`, {
    startMonth: new Date().getMonth() + 1, startYear: new Date().getFullYear(),
    currency: 'Bs', annualGoal: 0,
    categoriasIngresos: ['Ventas','Servicios','Otros'],
    categoriasGastos: ['Alquiler','Sueldos','Marketing','Servicios Públicos','Otros'],
    categoriasCostos: ['Materia Prima','Producción','Logística','Otros'],
    metodosPago: ['Efectivo','Tarjeta','Transferencia','Cheque'],
  }))

  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [costos, setCostos] = useState([])
  const [presupuesto, setPresupuesto] = useState({})
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!projectId || projectId === '__new__') { setLoadingData(false); return }
    fetchProjectData()
  }, [projectId])

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
    if (pres.data?.config) { setConfigState(prev => ({ ...prev, ...pres.data.config })); setPresupuesto(pres.data.presupuesto || {}) }
    setLoadingData(false)
  }

  const saveConfig = async (newConfig) => {
    setConfigState(newConfig)
    await supabase.from('project_config').upsert({ project_id: projectId, config: newConfig, presupuesto })
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
    const record = {
      ...item, id: generateId(), project_id: projectId, type,
      month: date.getMonth() + 1, year: date.getFullYear(),
      valorImpuesto, totalNeto: Math.round((amount - valorImpuesto) * 100) / 100,
    }
    const { error } = await supabase.from('transactions').insert(record)
    if (!error) {
      if (type==='ingreso') setIngresos(p => [...p, record])
      else if (type==='gasto') setGastos(p => [...p, record])
      else setCostos(p => [...p, record])
    } else { console.error(error) }
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
    }
  }

  const deleteTransaction = async (type, id) => {
    if (isReadOnly) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) {
      const setter = type==='ingreso' ? setIngresos : type==='gasto' ? setGastos : setCostos
      setter(p => p.filter(x => x.id !== id))
    }
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
    }
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
      return true
    } catch { return false }
  }, [projectId])

  const clearAllData = useCallback(async () => {
    if (isReadOnly) return
    await supabase.from('transactions').delete().eq('project_id', projectId)
    setIngresos([]); setGastos([]); setCostos([])
  }, [projectId])

  // ============================================================
  // RECURRING TEMPLATES (plantillas de gastos/ingresos/costos recurrentes)
  // ============================================================
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    if (!projectId || projectId === '__new__') return
    fetchTemplates()
  }, [projectId])

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('created_at')
    if (data) setTemplates(data)
  }

  const addTemplate = useCallback(async (tpl) => {
    if (isReadOnly) return
    const record = { ...tpl, id: generateId(), project_id: projectId, active: true }
    const { error } = await supabase.from('recurring_templates').insert(record)
    if (!error) setTemplates(prev => [...prev, record])
  }, [projectId, isReadOnly])

  const deleteTemplate = useCallback(async (id) => {
    if (isReadOnly) return
    const { error } = await supabase.from('recurring_templates').update({ active: false }).eq('id', id)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
  }, [isReadOnly])

  // Returns templates of a given type that have NOT been registered this month yet
  const getPendingTemplates = useCallback((type, month, year) => {
    const typeMap = { ingreso: ingresos, gasto: gastos, costo: costos }
    const records = typeMap[type] || []
    const usedThisMonth = new Set(
      records.filter(r => r.month === month && r.year === year).map(r => `${r.categoria}|${r.descripcion}`)
    )
    return templates
      .filter(t => t.type === type)
      .filter(t => !usedThisMonth.has(`${t.categoria}|${t.descripcion}`))
  }, [templates, ingresos, gastos, costos])

  // ============================================================
  // TAX PAYMENTS (previsión IVA / IT / RC-IVA vs pago real)
  // ============================================================
  const [taxPayments, setTaxPayments] = useState([])

  useEffect(() => {
    if (!projectId || projectId === '__new__') return
    fetchTaxPayments()
  }, [projectId])

  const fetchTaxPayments = async () => {
    const { data } = await supabase
      .from('tax_payments')
      .select('*')
      .eq('project_id', projectId)
    if (data) setTaxPayments(data)
  }

  const saveTaxPayment = useCallback(async (taxType, periodKey, realPaid, paidDate, notes) => {
    if (isReadOnly) return
    const existing = taxPayments.find(t => t.tax_type === taxType && t.period_key === periodKey)
    const record = {
      id: existing?.id || generateId(),
      project_id: projectId,
      tax_type: taxType,
      period_key: periodKey,
      real_paid: realPaid,
      paid_date: paidDate || null,
      notes: notes || '',
    }
    const { error } = await supabase.from('tax_payments').upsert(record, { onConflict: 'project_id,tax_type,period_key' })
    if (!error) {
      setTaxPayments(prev => {
        const filtered = prev.filter(t => !(t.tax_type === taxType && t.period_key === periodKey))
        return [...filtered, record]
      })
    }
    return !error
  }, [projectId, isReadOnly, taxPayments])

  const getTaxPayment = useCallback((taxType, periodKey) => {
    return taxPayments.find(t => t.tax_type === taxType && t.period_key === periodKey)
  }, [taxPayments])

  // Calculates "Previsto" for a given tax type and month, based on gross income (ingresoTotal, not netted)
  const getTaxForecast = useCallback((taxType, month, year) => {
    const RATES = { iva: 0.13, it: 0.03, rciva: 0.125 }
    const grossIncome = ingresos
      .filter(x => x.month === month && x.year === year)
      .reduce((s, x) => s + (x.ingresoTotal || 0), 0)
    return grossIncome * (RATES[taxType] || 0)
  }, [ingresos])

  // RC-IVA forecast aggregated over a calendar quarter (sum of 3 months)
  const getQuarterTaxForecast = useCallback((taxType, quarterKey) => {
    // quarterKey format: "2026-Q2"
    const [yearStr, qStr] = quarterKey.split('-Q')
    const year = parseInt(yearStr)
    const q = parseInt(qStr)
    const months = [(q-1)*3 + 1, (q-1)*3 + 2, (q-1)*3 + 3]
    return months.reduce((sum, m) => sum + getTaxForecast(taxType, m, year), 0)
  }, [getTaxForecast])

  const getIngresosPorPeriodo = useCallback((month, year) => ingresos.filter(x => x.month===month && x.year===year), [ingresos])
  const getGastosPorPeriodo = useCallback((month, year) => gastos.filter(x => x.month===month && x.year===year), [gastos])
  const getCostosPorPeriodo = useCallback((month, year) => costos.filter(x => x.month===month && x.year===year), [costos])

  const getTotalesPorPeriodo = useCallback((month, year) => {
    const ing = getIngresosPorPeriodo(month, year), gas = getGastosPorPeriodo(month, year), cos = getCostosPorPeriodo(month, year)
    const ingresosNetos = ing.reduce((s,x) => s+x.totalNeto, 0), gastosTotales = gas.reduce((s,x) => s+x.totalNeto, 0), costosTotales = cos.reduce((s,x) => s+x.totalNeto, 0)
    return { ingresosNetos, gastosTotales, costosTotales, ganancia: ingresosNetos-gastosTotales-costosTotales, impuestosIngresos: ing.reduce((s,x)=>s+x.valorImpuesto,0), impuestosGastos: gas.reduce((s,x)=>s+x.valorImpuesto,0) }
  }, [getIngresosPorPeriodo, getGastosPorPeriodo, getCostosPorPeriodo])

  return (
    <AppContext.Provider value={{
      config, setConfig, theme, setTheme, periods, loadingData, project, isReadOnly,
      ingresos, addIngreso, deleteIngreso, updateIngreso,
      gastos, addGasto, deleteGasto, updateGasto,
      costos, addCosto, deleteCosto, updateCosto,
      presupuesto, updatePresupuesto,
      importData, exportData, importFromBackup, clearAllData,
      templates, addTemplate, deleteTemplate, getPendingTemplates,
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
