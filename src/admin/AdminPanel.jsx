import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

const ROLES = ['superadmin', 'admin', 'contador', 'readonly']
const ROLE_LABELS = {
  superadmin: { label: 'Super Admin', color: 'badge-red' },
  admin: { label: 'Administrador', color: 'badge-blue' },
  contador: { label: 'Contador', color: 'badge-green' },
  readonly: { label: 'Solo Lectura', color: 'badge-yellow' },
}
const PROJECT_ICONS = ['🏢','🏪','🚀','🏭','📦','🏬','🏗️','💼','🌐','🏆','🎯','🔑']

export default function AdminPanel({ onBack }) {
  const { profile } = useAuth()
  const [tab, setTab] = useState('projects')
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000) }

  const fetchAll = async () => {
    setLoading(true)
    const [p, u, m] = await Promise.all([
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('project_members').select('*, projects(name), profiles(full_name,email)'),
    ])
    if (p.data) setProjects(p.data)
    if (u.data) setUsers(u.data)
    if (m.data) setMembers(m.data)
    setLoading(false)
  }

  const saveProject = async (form) => {
    if (form.id) {
      const { error } = await supabase.from('projects').update({
        name: form.name, description: form.description, icon: form.icon,
      }).eq('id', form.id)
      if (error) { showMsg('❌ Error: ' + error.message, false); return }
      showMsg('✅ Proyecto actualizado')
    } else {
      const { error } = await supabase.from('projects').insert({
        name: form.name, description: form.description, icon: form.icon, created_by: profile.id,
      })
      if (error) { showMsg('❌ Error: ' + error.message, false); return }
      showMsg('✅ Proyecto creado')
    }
    setModal(null)
    fetchAll()
  }

  const deleteProject = async (id) => {
    if (!confirm('¿Eliminar proyecto y TODOS sus datos? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { showMsg('❌ Error: ' + error.message, false); return }
    showMsg('🗑️ Proyecto eliminado')
    fetchAll()
  }

  const createUser = async (form) => {
    const { data, error: e2 } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name } }
    })
    if (e2) { showMsg('❌ Error: ' + e2.message, false); return }

    await supabase.from('profiles').upsert({
      id: data?.user?.id, email: form.email, full_name: form.full_name, role: form.role,
    })

    showMsg(`✅ Usuario ${form.email} creado. Recibirá un correo de confirmación.`)
    setModal(null)
    fetchAll()
  }

  const updateUserRole = async (userId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) { showMsg('❌ Error: ' + error.message, false); return }
    showMsg('✅ Rol actualizado')
    fetchAll()
  }

  const toggleUserActive = async (userId, active) => {
    const { error } = await supabase.from('profiles').update({ active }).eq('id', userId)
    if (error) { showMsg('❌ Error: ' + error.message, false); return }
    showMsg(`✅ Usuario ${active ? 'activado' : 'desactivado'}`)
    fetchAll()
  }

  const addMember = async (form) => {
    const { error } = await supabase.from('project_members').upsert({
      project_id: form.project_id, user_id: form.user_id, role: form.role,
    })
    if (error) { showMsg('❌ Error: ' + error.message, false); return }
    showMsg('✅ Usuario asignado al proyecto')
    setModal(null)
    fetchAll()
  }

  const removeMember = async (projectId, userId) => {
    if (!confirm('¿Remover usuario del proyecto?')) return
    await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId)
    showMsg('✅ Usuario removido')
    fetchAll()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text3)' }}>Cargando panel de administración...</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{
        background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#4f8ef7,#a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'white',
          }}>⚙️</div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: '#fff' }}>Panel de Administración</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>ContaNegocios</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)' }}
          onClick={onBack}>← Volver a Proyectos</button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {msg && (
          <div style={{
            padding: '11px 16px', borderRadius: 8, marginBottom: 20,
            background: msg.ok ? 'rgba(45,212,160,0.12)' : 'rgba(247,86,106,0.12)',
            border: `1px solid ${msg.ok ? 'rgba(45,212,160,0.3)' : 'rgba(247,86,106,0.3)'}`,
            color: msg.ok ? '#0d9e72' : '#d63348', fontWeight: 600, fontSize: 14,
          }}>{msg.text}</div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {[
            { id: 'projects', label: `📁 Proyectos (${projects.length})` },
            { id: 'users', label: `👥 Usuarios (${users.length})` },
            { id: 'members', label: `🔗 Asignaciones (${members.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '9px 18px', border: 'none', cursor: 'pointer', background: 'transparent',
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
                color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.18s', marginBottom: -1,
              }}>{t.label}</button>
          ))}
        </div>

        {tab === 'projects' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'project', data: {} })}>+ Nuevo Proyecto</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Proyecto</th><th>Descripción</th><th>Creado</th><th>Miembros</th><th>Acciones</th></tr></thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 22 }}>{p.icon || '🏢'}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                        </div>
                      </td>
                      <td>{p.description}</td>
                      <td>{new Date(p.created_at).toLocaleDateString('es')}</td>
                      <td><span className="badge badge-blue">{members.filter(m => m.project_id === p.id).length} usuarios</span></td>
                      <td>
                        <div className="td-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'project', data: p })}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteProject(p.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'user', data: { role: 'contador' } })}>+ Nuevo Usuario</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{u.full_name || '—'}</td>
                      <td>{u.email}</td>
                      <td>
                        <select className="form-select" style={{ padding: '4px 8px', fontSize: 12, maxWidth: 140 }}
                          value={u.role || 'contador'} onChange={e => updateUserRole(u.id, e.target.value)}
                          disabled={u.id === profile?.id}>
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>)}
                        </select>
                      </td>
                      <td><span className={`badge ${u.active !== false ? 'badge-green' : 'badge-red'}`}>{u.active !== false ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <div className="td-actions">
                          {u.id !== profile?.id && (
                            <button className={`btn btn-sm ${u.active !== false ? 'btn-danger' : 'btn-ghost'}`}
                              onClick={() => toggleUserActive(u.id, u.active === false)}>
                              {u.active !== false ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'member', data: { role: 'contador' } })}>+ Asignar Usuario a Proyecto</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Usuario</th><th>Proyecto</th><th>Rol en Proyecto</th><th>Acciones</th></tr></thead>
                <tbody>
                  {members.map(m => (
                    <tr key={`${m.project_id}-${m.user_id}`}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{m.profiles?.full_name || m.profiles?.email}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.profiles?.email}</div>
                      </td>
                      <td>{m.projects?.name}</td>
                      <td><span className={`badge ${ROLE_LABELS[m.role]?.color || 'badge-blue'}`}>{ROLE_LABELS[m.role]?.label || m.role}</span></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => removeMember(m.project_id, m.user_id)}>Remover</button></td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr><td colSpan={4}><div className="empty-state"><div className="icon">🔗</div><p>No hay asignaciones aún</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'project' && <ProjectModal data={modal.data} icons={PROJECT_ICONS} onSave={saveProject} onClose={() => setModal(null)} />}
      {modal?.type === 'user' && <UserModal data={modal.data} onSave={createUser} onClose={() => setModal(null)} />}
      {modal?.type === 'member' && <MemberModal data={modal.data} projects={projects} users={users} onSave={addMember} onClose={() => setModal(null)} />}
    </div>
  )
}

function ProjectModal({ data, icons, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', icon: '🏢', ...data })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{data.id ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Nombre del Proyecto *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Oficina Central" />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descripción breve del proyecto" />
          </div>
          <div className="form-group">
            <label className="form-label">Ícono</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {icons.map(icon => (
                <button key={icon} onClick={() => setForm(p => ({ ...p, icon }))}
                  style={{
                    fontSize: 24, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                    border: form.icon === icon ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: form.icon === icon ? 'rgba(79,142,247,0.1)' : 'var(--surface)',
                    transition: 'all 0.15s',
                  }}>{icon}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => form.name && onSave(form)}>{data.id ? 'Guardar Cambios' : 'Crear Proyecto'}</button>
        </div>
      </div>
    </div>
  )
}

function UserModal({ data, onSave, onClose }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'contador', ...data })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Nuevo Usuario</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Nombre Completo *</label>
            <input className="form-input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Juan Pérez" />
          </div>
          <div className="form-group">
            <label className="form-label">Correo Electrónico *</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@empresa.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña Inicial *</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="form-group">
            <label className="form-label">Rol</label>
            <select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="superadmin">Super Admin — Acceso total</option>
              <option value="admin">Administrador — Gestiona proyectos</option>
              <option value="contador">Contador — Registra y edita datos</option>
              <option value="readonly">Solo Lectura — Solo ve reportes</option>
            </select>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(79,142,247,0.08)', borderRadius: 8, fontSize: 13, color: 'var(--text2)' }}>
            💡 El usuario recibirá un correo para confirmar su cuenta. La contraseña puede cambiarse después.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => form.full_name && form.email && form.password && onSave(form)}>Crear Usuario</button>
        </div>
      </div>
    </div>
  )
}

function MemberModal({ data, projects, users, onSave, onClose }) {
  const [form, setForm] = useState({ project_id: '', user_id: '', role: 'contador', ...data })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Asignar Usuario a Proyecto</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Proyecto *</label>
            <select className="form-select" value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}>
              <option value="">Seleccionar proyecto...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Usuario *</label>
            <select className="form-select" value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}>
              <option value="">Seleccionar usuario...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Rol en este Proyecto</label>
            <select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="admin">Administrador</option>
              <option value="contador">Contador</option>
              <option value="readonly">Solo Lectura</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => form.project_id && form.user_id && onSave(form)}>Asignar</button>
        </div>
      </div>
    </div>
  )
}
