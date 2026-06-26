import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppProvider } from './context/AppContext'
import LoginPage from './auth/LoginPage'
import ProjectSelector from './auth/ProjectSelector'
import AdminPanel from './admin/AdminPanel'
import Dashboard from './pages/Dashboard'
import Banco from './pages/Banco'
import PrevisionesPage from './pages/Previsiones'
import Configuracion from './pages/Configuracion'
import Ingresos from './pages/Ingresos'
import Gastos from './pages/Gastos'
import Costos from './pages/Costos'
import Presupuesto from './pages/Presupuesto'
import Diario from './pages/Diario'
import Mensual from './pages/Mensual'
import Anual from './pages/Anual'
import Flujo from './pages/Flujo'
import Balance from './pages/Balance'
import Impuestos from './pages/Impuestos'
import ImportExport from './pages/ImportExport'
import './index.css'

const TABS = [
  { id: 'dashboard',    label: '📊 Monitor' },
  { id: 'banco',        label: '🏦 Banco' },
  { id: 'previsiones',  label: '📋 Previsiones' },
  { id: 'ingresos',     label: '💰 Ingresos' },
  { id: 'gastos',       label: '💸 Gastos' },
  { id: 'costos',       label: '🏭 Costos' },
  { id: 'presupuesto',  label: '📋 Presupuesto' },
  { id: 'diario',       label: '📅 Diario' },
  { id: 'mensual',      label: '📆 Mensual' },
  { id: 'anual',        label: '📊 Anual' },
  { id: 'flujo',        label: '🌊 Flujo' },
  { id: 'balance',      label: '⚖️ Balance' },
  { id: 'impuestos',    label: '🧾 Impuestos' },
  { id: 'configuracion',label: '⚙️ Config' },
  { id: 'importexport', label: '📤 Imp/Exp' },
]

const THEMES = [
  { id: 'light', label: '☀️ Claro' },
  { id: 'soft',  label: '🌿 Suave' },
  { id: 'dark',  label: '🌙 Oscuro' },
]

function MainApp({ project, onBack }) {
  const { profile, signOut, isSuperAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setThemeLocal] = useState(() => localStorage.getItem('cn_theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cn_theme', theme)
    document.title = `${project.name} — ContaNegocios`
  }, [theme, project.name])

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':    return <Dashboard />
      case 'banco':        return <Banco />
      case 'previsiones':  return <PrevisionesPage />
      case 'configuracion':return <Configuracion />
      case 'ingresos':     return <Ingresos />
      case 'gastos':       return <Gastos />
      case 'costos':       return <Costos />
      case 'presupuesto':  return <Presupuesto />
      case 'diario':       return <Diario />
      case 'mensual':      return <Mensual />
      case 'anual':        return <Anual />
      case 'flujo':        return <Flujo />
      case 'balance':      return <Balance />
      case 'impuestos':    return <Impuestos />
      case 'importexport': return <ImportExport />
      default:             return <Dashboard />
    }
  }

  return (
    <AppProvider project={project}>
      <div className="app">
        <header className="app-header">
          <div className="header-brand">
            <div className="brand-icon">{project.icon || '₿'}</div>
            <div>
              <h1 className="brand-title" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                {project.name}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>— ContaNegocios</span>
              </h1>
              <p className="brand-sub">
                <span
                  style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                  onClick={() => onBack()}
                  title="Volver a la lista de proyectos"
                >
                  ⇄ Cambiar de proyecto
                </span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'right', marginRight: 4 }}>
              <div>{profile?.full_name || profile?.email}</div>
              <div style={{ textTransform: 'capitalize', color: 'var(--text3)', fontSize: 11 }}>{profile?.role}</div>
            </div>
            {isSuperAdmin && (
              <button className="theme-btn" onClick={() => onBack('admin')} title="Panel de Administración">
                ⚙️ Admin
              </button>
            )}
            <div className="theme-switcher">
              {THEMES.map(t => (
                <button key={t.id} className={`theme-btn ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setThemeLocal(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <button className="theme-btn" onClick={signOut}>Salir</button>
          </div>
        </header>

        <nav className="tab-nav">
          <div className="tabs-scroll">
            {TABS.map(tab => (
              <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="app-main">{renderPage()}</main>

        <footer className="app-footer">
          <p>ContaNegocios © {new Date().getFullYear()} — {project.name} — Datos guardados en la nube</p>
        </footer>
      </div>
    </AppProvider>
  )
}

function AppRouter() {
  const { session, loading, isSuperAdmin } = useAuth()
  const [selectedProject, setSelectedProject] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('cn_theme') || 'light')
  }, [])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--text3)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>₿</div>
        <p>Cargando ContaNegocios...</p>
      </div>
    </div>
  )

  if (!session) return <LoginPage />

  if (showAdmin && isSuperAdmin) return (
    <AdminPanel onBack={() => setShowAdmin(false)} />
  )

  if (!selectedProject) return (
    <ProjectSelector onSelect={(p) => {
      if (p.id === '__new__') { setShowAdmin(true); return }
      setSelectedProject(p)
    }} />
  )

  return (
    <MainApp
      project={selectedProject}
      onBack={(dest) => {
        setSelectedProject(null)
        if (dest === 'admin') setShowAdmin(true)
      }}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
