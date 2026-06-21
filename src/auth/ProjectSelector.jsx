import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'

export default function ProjectSelector({ onSelect }) {
  const { profile, signOut, isSuperAdmin } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchProjects() }, [])

  const fetchProjects = async () => {
    setLoading(true)
    let list = []
    if (isSuperAdmin) {
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      list = data || []
    } else {
      const { data } = await supabase
        .from('project_members')
        .select('project_id, role, projects(*)')
        .eq('user_id', profile.id)
      list = (data || []).map(m => ({ ...m.projects, member_role: m.role })).filter(Boolean)
    }
    setProjects(list)
    setLoading(false)
  }

  const ICONS = ['🏢', '🏪', '🚀', '🏭', '📦', '🏬', '🏗️', '💼', '🌐', '🏆']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 900, margin: '0 auto 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #4f8ef7, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'white',
          }}>₿</div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: 'var(--text)' }}>ContaNegocios</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {profile?.full_name || profile?.email} •{' '}
              <span style={{ textTransform: 'capitalize', color: 'var(--accent)' }}>{profile?.role}</span>
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={signOut}>Cerrar sesión</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 26, color: 'var(--text)', marginBottom: 6 }}>
            Selecciona un Proyecto
          </h2>
          <p style={{ color: 'var(--text3)', fontSize: 14 }}>
            Tienes acceso a {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Cargando proyectos...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} icon={ICONS[i % ICONS.length]} onClick={() => onSelect(project)} />
            ))}

            {isSuperAdmin && (
              <button onClick={() => onSelect({ id: '__new__' })}
                style={{
                  background: 'transparent', border: '2px dashed var(--border2)', borderRadius: 14,
                  padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text3)',
                  transition: 'all 0.18s', minHeight: 160,
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}>
                <div style={{ fontSize: 32 }}>➕</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Nuevo Proyecto</div>
              </button>
            )}

            {projects.length === 0 && !isSuperAdmin && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <p>No tienes proyectos asignados aún.</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>Contacta al administrador.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, icon, onClick }) {
  return (
    <button onClick={onClick} className="card"
      style={{
        cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 14, padding: 24,
        textAlign: 'left', background: 'var(--bg2)', transition: 'all 0.18s',
        display: 'flex', flexDirection: 'column', gap: 12, minHeight: 160,
      }}
      onMouseOver={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(79,142,247,0.15)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}>
      <div style={{ fontSize: 36 }}>{project.icon || icon}</div>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, marginBottom: 4 }}>{project.name}</div>
        {project.description && (
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{project.description}</div>
        )}
      </div>
      {project.member_role && (
        <div style={{ marginTop: 'auto' }}>
          <span className="badge badge-blue" style={{ fontSize: 11, textTransform: 'capitalize' }}>
            {project.member_role}
          </span>
        </div>
      )}
    </button>
  )
}
