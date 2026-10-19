import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { X, Check, Plus, ExternalLink, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const CATEGORY_EMOJIS = {
  food: '🍔', transport: '🚗', accommodation: '🏠',
  entertainment: '🎬', utilities: '💡', shopping: '🛍️',
  health: '❤️', other: '📦',
};

const FriendDetailModal = ({ friendId, onClose, onSettle, onAddExpense }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friendId) return;
    setLoading(true);
    API.get(`/api/expenses/friends/${friendId}`)
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [friendId]);

  if (!friendId) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="user-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
              {data?.friend?.name ? data.friend.name[0].toUpperCase() : '👤'}
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: 16 }}>{data?.friend?.name || 'Friend Details'}</h2>
              <div className="text-xs text-muted">{data?.friend?.email}</div>
            </div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card animate-pulse" style={{ height: 80 }} />
              <div className="card animate-pulse" style={{ height: 120 }} />
            </div>
          ) : !data ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-title">Could not load details</div>
            </div>
          ) : (
            <div>
              {/* Overall Net Balance Banner */}
              <div style={{
                background: data.netBalance > 0.01
                  ? 'rgba(16, 185, 129, 0.08)'
                  : data.netBalance < -0.01
                  ? 'rgba(244, 63, 94, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${
                  data.netBalance > 0.01
                    ? 'rgba(16, 185, 129, 0.25)'
                    : data.netBalance < -0.01
                    ? 'rgba(244, 63, 94, 0.25)'
                    : 'var(--border-color, rgba(255, 255, 255, 0.08))'
                }`,
                borderRadius: 12, padding: '16px 20px', marginBottom: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              }}>
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                    fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase',
                  }}>
                    <ShieldCheck size={13} style={{ color: 'var(--emerald)' }} /> Single Point Net Balance
                  </div>
                  <div style={{
                    fontSize: 28, fontWeight: 800,
                    color: data.netBalance > 0.01 ? 'var(--emerald)' : data.netBalance < -0.01 ? 'var(--rose)' : 'inherit',
                  }}>
                    {data.netBalance > 0.01 ? '+' : ''}₹{Math.abs(data.netBalance).toFixed(0)}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    {data.netBalance > 0.01
                      ? `${data.friend.name} owes you across all shared accounts`
                      : data.netBalance < -0.01
                      ? `You owe ${data.friend.name} across all shared accounts`
                      : 'All settled up across groups and direct splits ✓'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {Math.abs(data.netBalance) > 0.01 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onSettle?.({
                          fromUserId: data.netBalance < 0 ? user._id : data.friend._id,
                          toUserId: data.netBalance < 0 ? data.friend._id : user._id,
                          fromName: data.netBalance < 0 ? (user.name + ' (you)') : data.friend.name,
                          toName: data.netBalance < 0 ? data.friend.name : (user.name + ' (you)'),
                          amount: Math.abs(data.netBalance).toFixed(2),
                          groups: data.groupBreakdown,
                          directBalance: data.directBalance,
                        });
                        onClose();
                      }}
                    >
                      ⚡ 1-Click Settle ₹{Math.abs(data.netBalance).toFixed(0)}
                    </button>
                  )}
                </div>
              </div>

              {/* Source Breakdown (Direct & Groups) */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Debt Breakdown by Source
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {/* Direct splits card */}
                  <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>📱 Direct Non-Group</span>
                      <span className={`badge ${
                        data.directBalance > 0.01 ? 'badge-green' : data.directBalance < -0.01 ? 'badge-rose' : 'badge-gray'
                      }`} style={{ fontSize: 10 }}>
                        {data.directBalance > 0.01 ? `+₹${data.directBalance.toFixed(0)}` : data.directBalance < -0.01 ? `-₹${Math.abs(data.directBalance).toFixed(0)}` : 'Settled'}
                      </span>
                    </div>
                    <div className="text-xs text-muted">Direct individual splits</div>
                  </div>

                  {/* Shared groups cards */}
                  {data.groupBreakdown && data.groupBreakdown.length > 0 ? (
                    data.groupBreakdown.map((g) => (
                      <div key={g.groupId} className="card" style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>{g.groupIcon || '🏠'}</span> {g.groupName}
                          </span>
                          <span className={`badge ${
                            g.balance > 0.01 ? 'badge-green' : g.balance < -0.01 ? 'badge-rose' : 'badge-gray'
                          }`} style={{ fontSize: 10 }}>
                            {g.balance > 0.01 ? `+₹${g.balance.toFixed(0)}` : g.balance < -0.01 ? `-₹${Math.abs(g.balance).toFixed(0)}` : 'Settled'}
                          </span>
                        </div>
                        <div className="text-xs text-muted">
                          <Link to={`/groups/${g.groupId}`} onClick={onClose} style={{ color: 'var(--emerald)', textDecoration: 'none' }}>
                            Open group view →
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="card" style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                      No active group debts
                    </div>
                  )}
                </div>
              </div>

              {/* Shared Expenses Feed Preview */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Shared Transaction History ({data.expenses?.length || 0})
                  </h4>
                  <Link to="/friends" onClick={onClose} className="btn btn-ghost btn-xs">
                    View full page <ArrowRight size={11} />
                  </Link>
                </div>

                {data.expenses?.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>
                    <div className="text-xs text-muted">No shared transactions recorded yet</div>
                  </div>
                ) : (
                  <div className="expenses-list" style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {data.expenses.slice(0, 6).map((exp) => {
                      const isPayer = (exp.paidBy?._id || exp.paidBy)?.toString() === user._id;
                      const dateStr = exp.date ? format(new Date(exp.date), 'MMM d') : '';
                      return (
                        <div key={exp._id} className="expense-item" style={{ padding: '8px 12px' }}>
                          <div className="expense-category-icon" style={{ width: 28, height: 28, fontSize: 14 }}>
                            {exp.isSettlement ? '✅' : (CATEGORY_EMOJIS[exp.category] || '📦')}
                          </div>
                          <div className="expense-details">
                            <div className="expense-description" style={{ fontSize: 13 }}>{exp.description}</div>
                            <div className="expense-meta" style={{ fontSize: 11 }}>
                              <span>{isPayer ? 'You paid' : `${exp.paidBy?.name || 'Friend'} paid`} · {dateStr}</span>
                              {exp.groupId && (
                                <span className="badge badge-gray" style={{ fontSize: 9, marginLeft: 4 }}>
                                  {exp.groupId.icon || '🏠'} {exp.groupId.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="expense-amount" style={{ fontSize: 13, color: isPayer ? 'var(--emerald)' : 'var(--rose)' }}>
                              {isPayer ? '+' : '-'}₹{exp.totalAmount.toFixed(0)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              onAddExpense?.(data?.friend);
              onClose();
            }}
          >
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendDetailModal;
