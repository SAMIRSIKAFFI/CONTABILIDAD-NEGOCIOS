import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #4f8ef7, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 8px 32px rgba(79,142,247,0.35)',
          }}>₿</div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: 'var(--text)', marginBottom: 6 }}>
            ContaNegocios
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>Sistema de Contabilidad Empresarial</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
            Iniciar Sesión
          </h2>

          {error && (
            <div style={{
              background: 'rgba(247,86,106,0.1)', border: '1px solid rgba(247,86,106,0.3)',
              color: 'var(--accent-red)', padding: '10px 14px', borderRadius: 8,
              fontSize: 13, marginBottom: 18,
            }}>{error}</div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input className="form-input" type="email" required placeholder="usuario@empresa.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" required placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 15, marginTop: 8 }}
              disabled={loading}>
              {loading ? 'Ingresando...' : '→ Ingresar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, marginTop: 20 }}>
          ¿Olvidaste tu contraseña? Contacta al administrador del sistema.
        </p>
      </div>
    </div>
  )
}
