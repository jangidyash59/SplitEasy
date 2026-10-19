import { useState, useEffect, useCallback } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import {
  Users, Plus, Zap, Check, ArrowRight, UserPlus, Search, X, ChevronLeft, Trash2, Calendar, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import AddExpenseModal from '../components/AddExpenseModal';
import PeerSettleModal from '../components/PeerSettleModal';

const CATEGORY_EMOJIS = {
  food: '🍔', transport: '🚗', accommodation: '🏠',
  entertainment: '🎬', utilities: '💡', shopping: '🛍️',
  health: '❤️', other: '📦',
};

// ── Peer Debt Simplification Modal ─────────────────────────────────────────
const PeerDebtSimplificationModal = ({ transactions, onClose, onSettleDirect }) => {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">⚡ Simplified Peer Settlements</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-xs text-muted" style={{ marginBottom: 16 }}>
            Greedy Minimum Cash Flow reduces multi-friend debt chains to the fewest payments possible.
          </p>
          {transactions.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-icon">🎉</div>
              <div className="empty-state-title">No settlements needed!</div>
              <p className="empty-state-text">All direct balances are settled.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transactions.map((t, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600 }}>{t.from?.name || 'Unknown'}</span>
                    <ArrowRight size={14} style={{ color: 'var(--rose)' }} />
                    <span style={{ fontWeight: 600 }}>{t.to?.name || 'Unknown'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--emerald)', fontSize: 16 }}>
                      ₹{t.amount.toFixed(2)}
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onSettleDirect({
                        fromUserId: t.from?._id,
                        toUserId: t.to?._id,
                        fromName: t.from?.name,
                        toName: t.to?.name,
                        amount: t.amount,
                      })}
                    >
                      Settle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ── Search & Add Friend Modal ──────────────────────────────────────────────
const AddFriendModal = ({ existingFriendIds, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await API.get(`/api/auth/users/search?q=${encodeURIComponent(search.trim())}`);
        setResults((data.users || []).filter((u) => !existingFriendIds.includes(u._id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, existingFriendIds]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Add / Search Friend</h2>
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
                placeholder="e.g. Yash or yash@gmail.com"
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
                  <div className="user-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                    {u.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { onSelect(u); onClose(); }}
                  >
                    <Plus size={13} /> Split Expense
                  </button>
                </div>
              ))}
            </div>
          )}

          {search.length >= 2 && results.length === 0 && !searching && (
            <div className="text-sm text-muted text-center" style={{ padding: '20px 0' }}>
              No user found with that name or email.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main FriendsPage Component ─────────────────────────────────────────────
const FriendsPage = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active view: either list or single friend detail
  const [activeFriendId, setActiveFriendId] = useState(null);
  const [friendDetail, setFriendDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [settleTarget, setSettleTarget] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseFriend, setExpenseFriend] = useState(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [simplifiedTransactions, setSimplifiedTransactions] = useState(null);

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/expenses/friends');
      setFriends(data.friends || []);
    } catch {
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Load single friend details and individual expenses
  const loadFriendDetail = useCallback(async (friendId) => {
    setActiveFriendId(friendId);
    setDetailLoading(true);
    try {
      const { data } = await API.get(`/api/expenses/friends/${friendId}`);
      setFriendDetail(data);
    } catch {
      toast.error('Failed to load friend details');
      setActiveFriendId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSimplifyPeerDebts = async () => {
    try {
      const { data } = await API.get('/api/expenses/friends-settlements');
      setSimplifiedTransactions(data.transactions || []);
    } catch {
      toast.error('Failed to calculate settlements');
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!confirm('Delete this expense? Balances will be reversed.')) return;
    try {
      await API.delete(`/api/expenses/${expId}`);
      toast.success('Expense deleted');
      if (activeFriendId) loadFriendDetail(activeFriendId);
      fetchFriends();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  // Stats
  let totalOwedToYou = 0;
  let totalYouOwe = 0;
  friends.forEach((f) => {
    if (f.netBalance > 0.01) totalOwedToYou += f.netBalance;
    else if (f.netBalance < -0.01) totalYouOwe += Math.abs(f.netBalance);
  });
  const netPeerBalance = totalOwedToYou - totalYouOwe;

  return (
    <div className="page-container">
      {/* Detail View Back Button */}
      {activeFriendId ? (
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setActiveFriendId(null); setFriendDetail(null); fetchFriends(); }}
            style={{ marginBottom: 16 }}
          >
            <ChevronLeft size={16} /> Back to All Friends
          </button>

          {detailLoading || !friendDetail ? (
            <div className="card animate-pulse" style={{ height: 180 }} />
          ) : (
            <div>
              {/* Header for Friend Detail */}
              <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="user-avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                    {friendDetail.friend.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h1 className="page-title" style={{ marginBottom: 2 }}>{friendDetail.friend.name}</h1>
                    <div className="text-xs text-muted">{friendDetail.friend.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Math.abs(friendDetail.netBalance) > 0.01 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSettleTarget({
                        fromUserId: friendDetail.netBalance < 0 ? user._id : friendDetail.friend._id,
                        toUserId: friendDetail.netBalance < 0 ? friendDetail.friend._id : user._id,
                        fromName: friendDetail.netBalance < 0 ? (user.name + ' (you)') : friendDetail.friend.name,
                        toName: friendDetail.netBalance < 0 ? friendDetail.friend.name : (user.name + ' (you)'),
                        amount: Math.abs(friendDetail.netBalance).toFixed(2),
                      })}
                    >
                      <Check size={14} /> Settle ₹{Math.abs(friendDetail.netBalance).toFixed(0)}
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setExpenseFriend(friendDetail.friend);
                      setShowAddExpense(true);
                    }}
                  >
                    <Plus size={14} /> Add Expense with {friendDetail.friend.name}
                  </button>
                </div>
              </div>

              {/* Single Point of Net Settlement Banner */}
              <div style={{
                background: friendDetail.netBalance > 0.01
                  ? 'rgba(16, 185, 129, 0.08)'
                  : friendDetail.netBalance < -0.01
                  ? 'rgba(244, 63, 94, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${
                  friendDetail.netBalance > 0.01
                    ? 'rgba(16, 185, 129, 0.25)'
                    : friendDetail.netBalance < -0.01
                    ? 'rgba(244, 63, 94, 0.25)'
                    : 'var(--border-color, rgba(255, 255, 255, 0.08))'
                }`,
                borderRadius: 12, padding: '18px 22px', marginBottom: 20,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                  fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase',
                }}>
                  <ShieldCheck size={13} style={{ color: 'var(--emerald)' }} /> Single Point Net Balance (All Shared Accounts)
                </div>
                <div style={{
                  fontSize: 32, fontWeight: 800,
                  color: friendDetail.netBalance > 0.01 ? 'var(--emerald)' : friendDetail.netBalance < -0.01 ? 'var(--rose)' : 'inherit',
                }}>
                  {friendDetail.netBalance > 0.01 ? '+' : ''}₹{Math.abs(friendDetail.netBalance).toFixed(0)}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  {friendDetail.netBalance > 0.01
                    ? `${friendDetail.friend.name} owes you across all shared groups & direct splits`
                    : friendDetail.netBalance < -0.01
                    ? `You owe ${friendDetail.friend.name} across all shared groups & direct splits`
                    : 'All settled up across groups and direct splits ✓'}
                </div>
              </div>

              {/* Debt Breakdown by Source */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Debt Breakdown by Source
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>📱 Direct Non-Group</span>
                      <span className={`badge ${
                        (friendDetail.directBalance || 0) > 0.01 ? 'badge-green' : (friendDetail.directBalance || 0) < -0.01 ? 'badge-rose' : 'badge-gray'
                      }`} style={{ fontSize: 10 }}>
                        {(friendDetail.directBalance || 0) > 0.01 ? `+₹${friendDetail.directBalance.toFixed(0)}` : (friendDetail.directBalance || 0) < -0.01 ? `-₹${Math.abs(friendDetail.directBalance).toFixed(0)}` : 'Settled'}
                      </span>
                    </div>
                    <div className="text-xs text-muted">Direct individual peer splits</div>
                  </div>

                  {friendDetail.groupBreakdown && friendDetail.groupBreakdown.length > 0 ? (
                    friendDetail.groupBreakdown.map((g) => (
                      <div key={g.groupId} className="card" style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>{g.groupIcon || '🏠'}</span> {g.groupName}
                          </span>
                          <span className={`badge ${
                            g.balance > 0.01 ? 'badge-green' : g.balance < -0.01 ? 'badge-rose' : 'badge-gray'
                          }`} style={{ fontSize: 10 }}>
                            {g.balance > 0.01 ? `+₹${g.balance.toFixed(0)}` : g.balance < -0.01 ? `-₹${Math.abs(g.balance).toFixed(0)}` : 'Settled'}
                          </span>
                        </div>
                        <div className="text-xs text-muted">Balance within shared group</div>
                      </div>
                    ))
                  ) : (
                    <div className="card" style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                      No active debts in shared groups
                    </div>
                  )}
                </div>
              </div>

              {/* Expense History with this friend */}
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Shared Transaction History ({friendDetail.expenses?.length || 0})
              </h3>

              {friendDetail.expenses?.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="empty-state-icon">💸</div>
                  <div className="empty-state-title">No direct expenses yet</div>
                  <p className="empty-state-text">Add an expense to start tracking with {friendDetail.friend.name}.</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setExpenseFriend(friendDetail.friend);
                      setShowAddExpense(true);
                    }}
                  >
                    <Plus size={14} /> Add First Expense
                  </button>
                </div>
              ) : (
                <div className="expenses-list">
                  {friendDetail.expenses.map((exp) => {
                    const isPayer = (exp.paidBy?._id || exp.paidBy).toString() === user._id;
                    const mySplit = exp.splits?.find((s) => (s.userId?._id || s.userId).toString() === user._id);
                    const friendSplit = exp.splits?.find((s) => (s.userId?._id || s.userId).toString() === friendDetail.friend._id);

                    return (
                      <div key={exp._id} className="expense-item">
                        <div className="expense-category-icon">
                          {exp.isSettlement ? '✅' : (CATEGORY_EMOJIS[exp.category] || '📦')}
                        </div>
                        <div className="expense-details">
                          <div className="expense-description">{exp.description}</div>
                          <div className="expense-meta">
                            {exp.isSettlement ? '✅ Settlement' : `Paid by ${exp.paidBy?.name || 'Unknown'}`}
                            {' · '}
                            {format(new Date(exp.date), 'MMM d, yyyy')}
                            {' · '}
                            <span className="badge badge-gray" style={{ fontSize: 10 }}>{exp.splitType}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {exp.isSettlement ? (
                            <div className="expense-amount" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                              Settlement ₹{exp.totalAmount}
                            </div>
                          ) : (
                            <>
                              <div className="expense-amount" style={{ color: isPayer ? 'var(--emerald)' : 'var(--rose)' }}>
                                {isPayer ? `+₹${friendSplit?.amount?.toFixed(0) || '0'}` : `-₹${mySplit?.amount?.toFixed(0) || '0'}`}
                              </div>
                              <div className="text-xs text-muted">₹{exp.totalAmount.toFixed(0)} total</div>
                            </>
                          )}
                        </div>

                        {isPayer && !exp.isSettlement && (
                          <button
                            className="btn btn-icon btn-ghost"
                            title="Delete expense"
                            style={{ opacity: 0.4, marginLeft: 6 }}
                            onClick={() => handleDeleteExpense(exp._id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── All Friends List View ────────────────────────────────────────── */
        <div>
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Friends & Net Settlements</h1>
              <p className="page-subtitle">Single point of settlement across all shared groups & direct individual splits</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={handleSimplifyPeerDebts}>
                <Zap size={15} /> Simplify All Debts
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddFriendModal(true)}>
                <UserPlus size={15} /> Find Friend
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setExpenseFriend(null); setShowAddExpense(true); }}
              >
                <Plus size={15} /> Add Individual Expense
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Net Balance across Friends</div>
              <div className={`stat-value ${netPeerBalance > 0.01 ? 'positive' : netPeerBalance < -0.01 ? 'negative' : 'neutral'}`}>
                {netPeerBalance > 0.01 ? '+' : ''}₹{Math.abs(netPeerBalance).toFixed(0)}
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                {netPeerBalance > 0.01 ? 'Friends owe you' : netPeerBalance < -0.01 ? 'You owe friends' : 'All settled up ✓'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Friends Owe You</div>
              <div className="stat-value positive">₹{totalOwedToYou.toFixed(0)}</div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>Groups + Direct Splits</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">You Owe Friends</div>
              <div className="stat-value negative">₹{totalYouOwe.toFixed(0)}</div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>Groups + Direct Splits</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Connections</div>
              <div className="stat-value neutral">{friends.length}</div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>Connected friends & peers</div>
            </div>
          </div>

          {/* Friends List */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => <div key={i} className="card animate-pulse" style={{ height: 72 }} />)}
            </div>
          ) : friends.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🤝</div>
              <div className="empty-state-title">No connections yet</div>
              <p className="empty-state-text">
                Add friends or join groups to start tracking net settlements in one place!
              </p>
              <button className="btn btn-primary" onClick={() => setShowAddFriendModal(true)}>
                <UserPlus size={16} /> Find a Friend to Split With
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {friends.map((f) => {
                const bal = f.netBalance;
                return (
                  <div
                    key={f.user._id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                    onClick={() => loadFriendDetail(f.user._id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div className="user-avatar" style={{ width: 42, height: 42, fontSize: 16 }}>
                        {f.user.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {f.user.name}
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{f.user.email}</span>
                        </div>
                        {/* Breakdown Source Chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {f.groupBreakdown && f.groupBreakdown.length > 0 && f.groupBreakdown.map((g) => (
                            <span key={g.groupId} className="badge badge-gray" style={{ fontSize: 10, padding: '1px 6px' }}>
                              {g.groupIcon || '🏠'} {g.groupName}: {g.balance > 0 ? '+' : ''}₹{Math.abs(g.balance).toFixed(0)}
                            </span>
                          ))}
                          {typeof f.directBalance === 'number' && Math.abs(f.directBalance) > 0.01 && (
                            <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 6px' }}>
                              📱 Direct: {f.directBalance > 0 ? '+' : ''}₹{Math.abs(f.directBalance).toFixed(0)}
                            </span>
                          )}
                          {Math.abs(bal) < 0.01 && (
                            <span className="badge badge-green" style={{ fontSize: 10, padding: '1px 6px' }}>
                              All accounts settled ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        {Math.abs(bal) < 0.01 ? (
                          <span className="badge badge-green" style={{ fontSize: 11 }}>Settled ✓</span>
                        ) : (
                          <>
                            <div style={{
                              fontWeight: 800, fontSize: 16,
                              color: bal > 0 ? 'var(--emerald)' : 'var(--rose)',
                            }}>
                              {bal > 0 ? '+' : ''}₹{Math.abs(bal).toFixed(0)}
                            </div>
                            <div className="text-xs text-muted">
                              {bal > 0 ? 'owes you net' : 'you owe net'}
                            </div>
                          </>
                        )}
                      </div>

                      {/* 1-Click Settle Button */}
                      {Math.abs(bal) > 0.01 && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettleTarget({
                              fromUserId: bal < 0 ? user._id : f.user._id,
                              toUserId: bal < 0 ? f.user._id : user._id,
                              fromName: bal < 0 ? (user.name + ' (you)') : f.user.name,
                              toName: bal < 0 ? f.user.name : (user.name + ' (you)'),
                              amount: Math.abs(bal).toFixed(2),
                              groups: f.groupBreakdown,
                              directBalance: f.directBalance,
                            });
                          }}
                        >
                          <Check size={13} /> Settle ₹{Math.abs(bal).toFixed(0)}
                        </button>
                      )}

                      <button
                        className="btn btn-icon btn-ghost"
                        title="View history"
                        style={{ opacity: 0.6 }}
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {settleTarget && (
        <PeerSettleModal
          target={settleTarget}
          onClose={() => setSettleTarget(null)}
          onSuccess={() => {
            fetchFriends();
            if (activeFriendId) loadFriendDetail(activeFriendId);
          }}
        />
      )}

      {simplifiedTransactions && (
        <PeerDebtSimplificationModal
          transactions={simplifiedTransactions}
          onClose={() => setSimplifiedTransactions(null)}
          onSettleDirect={(t) => {
            setSimplifiedTransactions(null);
            setSettleTarget(t);
          }}
        />
      )}

      {showAddFriendModal && (
        <AddFriendModal
          existingFriendIds={friends.map((f) => f.user._id)}
          onSelect={(selected) => {
            setExpenseFriend(selected);
            setShowAddExpense(true);
          }}
          onClose={() => setShowAddFriendModal(false)}
        />
      )}

      {showAddExpense && (
        <AddExpenseModal
          defaultFriend={expenseFriend}
          onClose={() => { setShowAddExpense(false); setExpenseFriend(null); }}
          onSuccess={() => {
            fetchFriends();
            if (activeFriendId) loadFriendDetail(activeFriendId);
          }}
        />
      )}
    </div>
  );
};

export default FriendsPage;
