import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { format } from 'date-fns';
import { Plus, Zap, ArrowRight, Trash2, ChevronLeft, Users, Check, Search, X, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import AddExpenseModal from '../components/AddExpenseModal';

const CATEGORY_EMOJIS = {
  food: '🍔', transport: '🚗', accommodation: '🏠',
  entertainment: '🎬', utilities: '💡', shopping: '🛍️',
  health: '❤️', other: '📦',
};

// ── Settle Modal ─────────────────────────────────────────────────────────────
const SettleModal = ({ group, members, balances, initialTarget, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  // Derive target
  const derivedTarget = (() => {
    if (initialTarget) return initialTarget;
    // Auto-detect first pending balance for user
    const myBalMap = balances[user._id] || {};
    for (const [otherId, amt] of Object.entries(myBalMap)) {
      if (typeof amt === 'number' && Math.abs(amt) > 0.01) {
        const otherMember = members.find((m) => (m._id || m).toString() === otherId);
        const otherName = otherMember?.name || 'Group member';
        return {
          fromUserId: amt < 0 ? user._id : otherId,
          toUserId: amt < 0 ? otherId : user._id,
          fromName: amt < 0 ? (user.name + ' (you)') : otherName,
          toName: amt < 0 ? otherName : (user.name + ' (you)'),
          amount: Math.abs(amt).toFixed(2),
        };
      }
    }
    return null;
  })();

  const [fromId, setFromId] = useState(derivedTarget?.fromUserId || user._id);
  const [toId, setToId] = useState(derivedTarget?.toUserId || '');
  const [amount, setAmount] = useState(derivedTarget?.amount || '');

  const handleSettle = async (from = fromId, to = toId, amt = amount) => {
    if (!to) { toast.error('Select who you are paying'); return; }
    const num = parseFloat(amt);
    if (!num || num <= 0) { toast.error('Enter a valid amount'); return; }
    setLoading(true);
    try {
      await API.post('/api/expenses/settle', {
        groupId: group._id, fromUserId: from, toUserId: to, amount: num,
      });
      toast.success('Settlement recorded! Email notification sent ✅');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settlement failed');
    } finally {
      setLoading(false);
    }
  };

  // If we have a derived target and user is not in custom mode -> Show 1-Click Confirmation!
  if (derivedTarget && !customMode) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 420 }}>
          <div className="modal-header">
            <h2 className="modal-title">⚡ Instant Settle Up</h2>
            <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              Confirm group settlement
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, margin: '14px 0',
            }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{derivedTarget.fromName}</span>
              <ArrowRight size={16} style={{ color: 'var(--emerald)' }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{derivedTarget.toName}</span>
            </div>
            <div style={{
              fontSize: 36, fontWeight: 800, color: 'var(--emerald)',
              margin: '12px 0',
            }}>
              ₹{Number(derivedTarget.amount).toFixed(2)}
            </div>
            <p className="text-xs text-muted" style={{ margin: '0 auto 16px', maxWidth: 320 }}>
              This clears the debt and automatically notifies {derivedTarget.toName} via email.
            </p>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, textDecoration: 'underline', color: 'var(--text-muted)' }}
              onClick={() => setCustomMode(true)}
            >
              Adjust amount or person
            </button>
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={() => handleSettle(derivedTarget.fromUserId, derivedTarget.toUserId, derivedTarget.amount)}
              disabled={loading}
            >
              {loading ? 'Settling…' : 'Confirm & Settle Now ✓'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Custom detailed mode fallback
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">✅ Settle Up</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Who is paying?</label>
            <select className="form-select" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} {m._id === user._id ? '(you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Who are they paying?</label>
            <select className="form-select" value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">— Select person —</option>
              {members.filter((m) => m._id !== fromId).map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input
              className="form-input"
              type="number"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => handleSettle()} disabled={loading}>
            {loading ? 'Recording…' : 'Settle Up'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Add Member Modal ─────────────────────────────────────────────────────────
const AddMemberModal = ({ groupId, existingMemberIds, onClose, onSuccess }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await API.get(`/api/auth/users/search?q=${encodeURIComponent(search.trim())}`);
        setResults((data.users || []).filter((u) => !existingMemberIds.includes(u._id)));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, existingMemberIds]);

  const handleAdd = async (userId, userName) => {
    setLoading(true);
    try {
      await API.post(`/api/groups/${groupId}/members`, { userId });
      toast.success(`${userName} added to group!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Add Member</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Search by name or email</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <input
                autoFocus
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder="e.g. Nikhil or nikhil@gmail.com"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {results.length > 0 && (
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}>
              {results.map((u) => (
                <div key={u._id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderBottom: '1px solid var(--border)',
                }}>
                  <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                    {u.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleAdd(u._id, u.name)}
                    disabled={loading}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {search.length >= 2 && results.length === 0 && (
            <div className="text-sm text-muted text-center" style={{ padding: '20px 0' }}>
              No new users found. They must be registered on SplitEasy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Group Detail Page ────────────────────────────────────────────────────────
const GroupDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [settlements, setSettlements] = useState([]);
  const [activeTab, setActiveTab] = useState('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [simplifying, setSimplifying] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [grpRes, expRes, balRes] = await Promise.all([
        API.get(`/api/groups/${id}`),
        API.get(`/api/expenses/group/${id}?limit=50`),
        API.get(`/api/expenses/group/${id}/balances`),
      ]);
      setGroup(grpRes.data.group);
      setExpenses(expRes.data.expenses || []);
      setBalances(balRes.data.balances || {});
    } catch (e) {
      toast.error('Failed to load group');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchSettlements = async () => {
    setSimplifying(true);
    try {
      const { data } = await API.get(`/api/expenses/group/${id}/settlements`);
      setSettlements(data.transactions || []);
      setActiveTab('settlements');
      if (data.fromCache) toast('⚡ From cache', { duration: 1500 });
    } catch {
      toast.error('Failed to calculate settlements');
    } finally {
      setSimplifying(false);
    }
  };

  useEffect(() => {
    fetchAll();
    if (socket) {
      socket.emit('join:group', id);
      socket.on('expense:added', () => { fetchAll(); toast.success('New expense added!'); });
      socket.on('settlement:done', () => { fetchAll(); toast.success('Settlement updated!'); });
    }
    return () => {
      if (socket) {
        socket.emit('leave:group', id);
        socket.off('expense:added');
        socket.off('settlement:done');
      }
    };
  }, [id, socket, fetchAll]);

  const handleDeleteExpense = async (expId) => {
    if (!confirm('Delete this expense? The balances will be reversed.')) return;
    try {
      await API.delete(`/api/expenses/${expId}`);
      toast.success('Expense deleted');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from group? They must have settled all debts first.`)) return;
    try {
      await API.delete(`/api/groups/${id}/members/${memberId}`);
      toast.success(`${memberName} removed`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot remove member');
    }
  };

  // ── Computed values ──────────────────────────────────────────────────
  const myId = user._id;
  const myBalanceMap = balances[myId] || {};
  // Sum only numeric values to avoid NaN
  const myNet = Object.values(myBalanceMap).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="card animate-pulse" style={{ height: 80 }} />)}
        </div>
      </div>
    );
  }

  if (!group) return null;

  const members = group.members || [];
  const isCreator = group.createdBy?._id === myId || group.createdBy === myId;

  return (
    <div className="page-container">
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/groups')} style={{ marginBottom: 16 }}>
        <ChevronLeft size={16} /> Back to Groups
      </button>

      {/* Group Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 40 }}>{group.icon}</span>
          <div>
            <h1 className="page-title" style={{ marginBottom: 2 }}>{group.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
              <Users size={13} />
              {members.length} member{members.length !== 1 ? 's' : ''}
              {group.description && ` · ${group.description}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMember(true)}>
            <UserPlus size={15} /> Add Member
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fetchSettlements} disabled={simplifying}>
            <Zap size={15} /> {simplifying ? 'Calculating…' : 'Simplify Debts'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettle(true)}>
            <Check size={15} /> Settle Up
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddExpense(true)}>
            <Plus size={15} /> Add Expense
          </button>
        </div>
      </div>

      {/* Balance summary cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Your Net Balance</div>
          <div className={`stat-value ${myNet > 0.01 ? 'positive' : myNet < -0.01 ? 'negative' : 'neutral'}`}>
            {myNet > 0.01 ? '+' : ''}₹{Math.abs(myNet).toFixed(0)}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
            {myNet > 0.01 ? 'You are owed overall' : myNet < -0.01 ? 'You owe overall' : 'All settled up ✓'}
          </div>
        </div>

        {/* Per-person balance cards */}
        {Object.entries(myBalanceMap).map(([uid, amt]) => {
          if (typeof amt !== 'number' || Math.abs(amt) < 0.01) return null;
          const member = members.find((m) => (m._id || m) === uid || m._id?.toString() === uid);
          const memberName = member?.name || uid;
          return (
            <div key={uid} className="stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">
                  {amt > 0 ? `${memberName} owes you` : `You owe ${memberName}`}
                </div>
                <div className={`stat-value ${amt > 0 ? 'positive' : 'negative'}`} style={{ fontSize: 22 }}>
                  ₹{Math.abs(amt).toFixed(0)}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10, alignSelf: 'flex-start', color: 'var(--emerald)', border: '1px solid rgba(16,185,129,0.3)' }}
                onClick={() => setSettleTarget({
                  fromUserId: amt < 0 ? myId : uid,
                  toUserId: amt < 0 ? uid : myId,
                  fromName: amt < 0 ? (user.name + ' (you)') : memberName,
                  toName: amt < 0 ? memberName : (user.name + ' (you)'),
                  amount: Math.abs(amt).toFixed(2),
                })}
              >
                <Check size={14} /> Settle ₹{Math.abs(amt).toFixed(0)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['expenses', 'settlements', 'members'].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'expenses' && expenses.length > 0 && (
              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 10 }}>{expenses.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Expenses Tab ───────────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💸</div>
            <div className="empty-state-title">No expenses yet</div>
            <p className="empty-state-text">Add your first expense to start tracking group spending.</p>
            <button className="btn btn-primary" onClick={() => setShowAddExpense(true)}>
              <Plus size={16} /> Add Expense
            </button>
          </div>
        ) : (
          <div className="expenses-list">
            {expenses.map((exp) => {
              const paidById = exp.paidBy?._id || exp.paidBy;
              const isPayer = paidById?.toString() === myId;
              const myShare = exp.splits?.find(
                (s) => (s.userId?._id || s.userId)?.toString() === myId
              )?.amount || 0;

              return (
                <div key={exp._id} className="expense-item">
                  <div className="expense-category-icon">
                    {exp.isSettlement ? '✅' : (CATEGORY_EMOJIS[exp.category] || '📦')}
                  </div>
                  <div className="expense-details">
                    <div className="expense-description">{exp.description}</div>
                    <div className="expense-meta">
                      Paid by {exp.paidBy?.name || 'Unknown'}
                      {' · '}
                      {format(new Date(exp.date), 'MMM d, yyyy')}
                      {' · '}
                      <span className="badge badge-gray" style={{ fontSize: 10, verticalAlign: 'middle' }}>
                        {exp.splitType}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {exp.isSettlement ? (
                      <div className="expense-amount" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Settlement</div>
                    ) : (
                      <>
                        <div className="expense-amount" style={{ color: isPayer ? 'var(--emerald)' : 'var(--rose)' }}>
                          {isPayer ? '+' : '-'}₹{myShare.toFixed(0)}
                        </div>
                        <div className="text-xs text-muted">₹{exp.totalAmount.toFixed(0)} total</div>
                      </>
                    )}
                  </div>
                  {isPayer && !exp.isSettlement && (
                    <button
                      className="btn btn-icon btn-ghost"
                      title="Delete expense"
                      style={{ opacity: 0.4, marginLeft: 4, flexShrink: 0 }}
                      onClick={() => handleDeleteExpense(exp._id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Settlements Tab (Greedy Algorithm Output) ───────────────── */}
      {activeTab === 'settlements' && (
        settlements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚖️</div>
            <div className="empty-state-title">Click "Simplify Debts" first</div>
            <p className="empty-state-text">
              Runs the Greedy Minimum Cash Flow algorithm to settle all debts in at most N−1 transactions.
            </p>
            <button className="btn btn-primary" onClick={fetchSettlements} disabled={simplifying}>
              <Zap size={16} /> {simplifying ? 'Calculating…' : 'Simplify Debts'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-green">
                <Zap size={10} /> {settlements.length} optimal transaction{settlements.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted">Greedy Minimum Cash Flow — cached in Redis ⚡</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {settlements.map((t, i) => (
                <div key={i} className="settlement-item">
                  <div className="user-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                    {(t.from?.name || '?')[0]}
                  </div>
                  <div className="settlement-names" style={{ flex: 1 }}>
                    <strong>{t.from?.name || t.from}</strong>
                    <span style={{ color: 'var(--text-muted)' }}> pays </span>
                    <strong>{t.to?.name || t.to}</strong>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                  <div className="settlement-amount">₹{t.amount.toFixed(2)}</div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowSettle(true)}
                  >
                    Settle
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Members Tab ────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>
              {members.length} Member{members.length !== 1 ? 's' : ''}
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMember(true)}>
              <UserPlus size={14} /> Add Member
            </button>
          </div>

          {members.length === 0 ? (
            <div className="text-sm text-muted text-center" style={{ padding: 20 }}>
              No members. Add some!
            </div>
          ) : (
            members.map((m) => {
              const memberId = m._id?.toString() || m.toString();
              const memberBal = balances[memberId] || {};
              const net = Object.values(memberBal).reduce(
                (s, v) => s + (typeof v === 'number' ? v : 0), 0
              );
              const isYou = memberId === myId;
              const isOwner = group.createdBy?._id === memberId || group.createdBy?.toString() === memberId;

              return (
                <div key={memberId} className="member-item">
                  <div className="user-avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
                    {(m.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.name || memberId}
                      {isYou && <span className="badge badge-green" style={{ fontSize: 10 }}>You</span>}
                      {isOwner && <span className="badge badge-blue" style={{ fontSize: 10 }}>Owner</span>}
                    </div>
                    <div className="text-xs text-muted">{m.email}</div>
                  </div>

                  {/* Net balance for this member */}
                  <div style={{ textAlign: 'right' }}>
                    {Math.abs(net) < 0.01 ? (
                      <span className="badge badge-green" style={{ fontSize: 11 }}>Settled ✓</span>
                    ) : (
                      <span style={{
                        fontWeight: 700, fontSize: 14,
                        color: net > 0 ? 'var(--emerald)' : 'var(--rose)',
                      }}>
                        {net > 0 ? '+' : ''}₹{Math.abs(net).toFixed(0)}
                      </span>
                    )}
                  </div>

                  {/* Remove button (only for non-you members, only if creator) */}
                  {!isYou && isCreator && (
                    <button
                      className="btn btn-icon btn-ghost"
                      title="Remove member"
                      style={{ opacity: 0.5, marginLeft: 4 }}
                      onClick={() => handleRemoveMember(memberId, m.name)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {showAddExpense && (
        <AddExpenseModal
          defaultGroupId={id}
          onClose={() => setShowAddExpense(false)}
          onSuccess={fetchAll}
        />
      )}

      {(showSettle || settleTarget) && (
        <SettleModal
          group={group}
          members={members}
          balances={balances}
          initialTarget={settleTarget}
          onClose={() => { setShowSettle(false); setSettleTarget(null); }}
          onSuccess={fetchAll}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          groupId={id}
          existingMemberIds={members.map((m) => m._id?.toString() || m.toString())}
          onClose={() => setShowAddMember(false)}
          onSuccess={fetchAll}
        />
      )}
    </div>
  );
};

export default GroupDetailPage;
