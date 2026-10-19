import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, X, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const ICONS = ['🏠', '🌴', '✈️', '🍕', '🎉', '🎮', '🏋️', '💼', '🎓', '🚗', '🛒', '💊'];

const CreateGroupModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', icon: '🏠', memberIds: [] });
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    API.get(`/api/auth/users/search?q=${search}`).then((r) => setSearchResults(r.data.users || []));
  }, [search]);

  const addUser = (u) => {
    if (!selectedUsers.find((x) => x._id === u._id)) {
      setSelectedUsers((prev) => [...prev, u]);
      setForm((f) => ({ ...f, memberIds: [...f.memberIds, u._id] }));
    }
    setSearch('');
    setSearchResults([]);
  };

  const removeUser = (uid) => {
    setSelectedUsers((prev) => prev.filter((u) => u._id !== uid));
    setForm((f) => ({ ...f, memberIds: f.memberIds.filter((id) => id !== uid) }));
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Group name required'); return; }
    setLoading(true);
    try {
      await API.post('/api/groups', form);
      toast.success(`Group "${form.name}" created! 🎉`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Create Group</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Icon picker */}
          <div className="form-group">
            <label className="form-label">Group Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon }))}
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: 18,
                    border: `2px solid ${form.icon === icon ? 'var(--emerald)' : 'var(--border)'}`,
                    borderRadius: 8,
                    background: form.icon === icon ? 'var(--emerald-glow)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Group Name *</label>
            <input className="form-input" placeholder="Hostel Trip, Office Lunch..." value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="What's this group for?" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Member search */}
          <div className="form-group">
            <label className="form-label">Add Members</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 36 }}
                placeholder="Search by name or email"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {searchResults.length > 0 && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {searchResults.map((u) => (
                  <div key={u._id} onClick={() => addUser(u)}
                    style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.name[0]}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedUsers.map((u) => (
                <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border)' }}>
                  <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.name[0]}</div>
                  <span style={{ flex: 1, fontSize: 13 }}>{u.name}</span>
                  <button className="btn btn-icon btn-ghost" style={{ width: 24, height: 24 }} onClick={() => removeUser(u._id)}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================== Groups Page ======================
const GroupsPage = () => {
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchGroups = async () => {
    try {
      const { data } = await API.get('/api/groups');
      setGroups(data.groups || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">Manage your expense groups</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Group
        </button>
      </div>

      {loading ? (
        <div className="groups-grid">
          {[1,2,3,4].map((i) => <div key={i} className="card animate-pulse" style={{ height: 140 }} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">No groups yet</div>
          <p className="empty-state-text">Create a group to start splitting expenses with friends, family, or colleagues.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create your first group
          </button>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((g) => {
            const bal = g.netBalance || 0;
            return (
              <Link to={`/groups/${g._id}`} key={g._id} className="group-card">
                <div className="group-icon">{g.icon}</div>
                <div className="group-name">{g.name}</div>
                <div className="group-members-count">
                  <Users size={12} style={{ display: 'inline', marginRight: 4 }} />
                  {g.members?.length} members
                </div>
                {g.description && (
                  <div className="text-xs text-muted" style={{ marginBottom: 10 }}>{g.description}</div>
                )}
                <div className={`group-balance ${bal >= 0 ? 'positive' : 'negative'}`}>
                  {bal === 0 ? (
                    <span className="badge badge-green">Settled up ✓</span>
                  ) : (
                    <>
                      {bal > 0 ? 'You are owed' : 'You owe'}{' '}
                      <span>₹{Math.abs(bal).toFixed(0)}</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateGroupModal onClose={() => setShowCreate(false)} onSuccess={fetchGroups} />
      )}
    </div>
  );
};

export default GroupsPage;
