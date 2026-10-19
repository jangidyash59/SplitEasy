import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Plus, ArrowRight, UserCheck, Users, ShieldCheck, Zap, Check, ChevronDown, ChevronUp, History
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import AddExpenseModal from '../components/AddExpenseModal';
import PeerSettleModal from '../components/PeerSettleModal';
import FriendDetailModal from '../components/FriendDetailModal';

const CATEGORY_EMOJIS = {
  food: '🍔', transport: '🚗', accommodation: '🏠',
  entertainment: '🎬', utilities: '💡', shopping: '🛍️',
  health: '❤️', other: '📦',
};

const Dashboard = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);
  const [inspectFriendId, setInspectFriendId] = useState(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, friendsRes, recentRes] = await Promise.all([
        API.get('/api/groups'),
        API.get('/api/expenses/friends').catch(() => ({ data: { friends: [] } })),
        API.get('/api/expenses/recent?limit=20').catch(() => ({ data: { expenses: [] } })),
      ]);

      const grps = groupsRes.data.groups || [];
      const frnds = friendsRes.data.friends || [];
      const recents = recentRes.data.expenses || [];

      setGroups(grps);
      setFriends(frnds);
      setRecentExpenses(recents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Compute stats across groups AND direct friends (preventing double counting)
  const stats = groups.reduce(
    (acc, g) => {
      const uid = user._id;
      const balMap = (g.groupBalances && g.groupBalances[uid]) || {};
      for (const v of Object.values(balMap)) {
        if (typeof v !== 'number') continue;
        if (v > 0.01) acc.totalOwed += v;
        else if (v < -0.01) acc.totalYouOwe += Math.abs(v);
      }
      return acc;
    },
    { totalOwed: 0, totalYouOwe: 0 }
  );

  // Add pure direct (non-group) friend balances
  friends.forEach((f) => {
    const dBal = typeof f.directBalance === 'number' ? f.directBalance : 0;
    if (dBal > 0.01) stats.totalOwed += dBal;
    else if (dBal < -0.01) stats.totalYouOwe += Math.abs(dBal);
  });

  const netBalance = stats.totalOwed - stats.totalYouOwe;

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hey, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Your unified hub for groups, net settlements, and direct splits</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Net Balance</div>
          <div className={`stat-value ${netBalance > 0.01 ? 'positive' : netBalance < -0.01 ? 'negative' : 'neutral'}`}>
            {netBalance > 0.01 ? '+' : ''}₹{Math.abs(netBalance).toFixed(0)}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
            {netBalance > 0.01 ? 'You are owed overall' : netBalance < -0.01 ? 'You owe overall' : 'All settled up ✓'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Others Owe You</div>
          <div className="stat-value positive">₹{stats.totalOwed.toFixed(0)}</div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>Groups + Direct Splits</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">You Owe</div>
          <div className="stat-value negative">₹{stats.totalYouOwe.toFixed(0)}</div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>Groups + Direct Splits</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Connections</div>
          <div className="stat-value neutral">{groups.length + friends.length}</div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>{groups.length} groups · {friends.length} direct friends</div>
        </div>
      </div>

      {/* 2 Main Focus Columns: Groups & Friends Net Settlement */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        {/* Column 1: Groups (Group-scoped ledger) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} /> Your Groups ({groups.length})
              </h2>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                Scoped group ledgers & shared expense pools
              </div>
            </div>
            <Link to="/groups" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2].map((i) => (
                <div key={i} className="card animate-pulse" style={{ height: 68 }} />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No groups yet</div>
              <p className="empty-state-text">Create a group for trips, rent, or friends.</p>
              <Link to="/groups" className="btn btn-primary btn-sm"><Plus size={14} /> Create group</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups.map((g) => {
                const bal = typeof g.netBalance === 'number' ? g.netBalance : 0;
                return (
                  <Link to={`/groups/${g._id}`} key={g._id} className="group-card" style={{ padding: '14px 16px' }}>
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 24 }}>{g.icon || '🏠'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="group-name" style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</div>
                        <div className="group-members-count" style={{ margin: '2px 0 0 0', fontSize: 12 }}>
                          {g.members?.length || 0} member{g.members?.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div>
                        {Math.abs(bal) < 0.01 ? (
                          <span className="badge badge-green" style={{ fontSize: 11 }}>Settled ✓</span>
                        ) : (
                          <span style={{
                            fontSize: 15, fontWeight: 700,
                            color: bal > 0 ? 'var(--emerald)' : 'var(--rose)',
                          }}>
                            {bal > 0 ? '+' : ''}₹{Math.abs(bal).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Friends & Net Settlement (Single Point of Settlement across all groups & direct) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={18} style={{ color: 'var(--emerald)' }} /> Friends & Net Settlement ({friends.length})
              </h2>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                ⚡ Single point of net settlement across all groups & direct splits
              </div>
            </div>
            <Link to="/friends" className="btn btn-ghost btn-sm">
              Manage <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2].map((i) => (
                <div key={i} className="card animate-pulse" style={{ height: 68 }} />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-state-icon">🤝</div>
              <div className="empty-state-title">No connections yet</div>
              <p className="empty-state-text">Add friends or invite members to groups to start tracking net settlements.</p>
              <Link to="/friends" className="btn btn-ghost btn-sm">Find Friends</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {friends.map((f) => {
                const isSettled = Math.abs(f.netBalance) < 0.01;
                return (
                  <div
                    key={f.user._id}
                    className="card"
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                    onClick={() => setInspectFriendId(f.user._id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      {/* Left: Avatar + Name + Source Tags */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div className="user-avatar" style={{ width: 38, height: 38, fontSize: 14 }}>
                          {f.user.name[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {f.user.name}
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                              {f.user.email}
                            </span>
                          </div>

                          {/* Breakdown Source Chips */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {f.groupBreakdown && f.groupBreakdown.length > 0 ? (
                              f.groupBreakdown.map((g) => (
                                <span key={g.groupId} className="badge badge-gray" style={{ fontSize: 10, padding: '1px 6px' }}>
                                  {g.groupIcon || '🏠'} {g.groupName}: {g.balance > 0 ? '+' : ''}₹{Math.abs(g.balance).toFixed(0)}
                                </span>
                              ))
                            ) : null}

                            {typeof f.directBalance === 'number' && Math.abs(f.directBalance) > 0.01 && (
                              <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 6px' }}>
                                📱 Direct: {f.directBalance > 0 ? '+' : ''}₹{Math.abs(f.directBalance).toFixed(0)}
                              </span>
                            )}

                            {isSettled && (
                              <span className="badge badge-green" style={{ fontSize: 10, padding: '1px 6px' }}>
                                All accounts settled ✓
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Net Balance & 1-Click Settle Button */}
                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div>
                          {isSettled ? (
                            <span className="badge badge-green" style={{ fontSize: 11 }}>Settled ✓</span>
                          ) : (
                            <div style={{
                              fontWeight: 800, fontSize: 15,
                              color: f.netBalance > 0 ? 'var(--emerald)' : 'var(--rose)',
                            }}>
                              {f.netBalance > 0 ? '+' : ''}₹{Math.abs(f.netBalance).toFixed(0)}
                            </div>
                          )}
                          <div className="text-xs text-muted" style={{ fontSize: 10 }}>
                            {f.netBalance > 0.01 ? 'owes you net' : f.netBalance < -0.01 ? 'you owe net' : ''}
                          </div>
                        </div>

                        {!isSettled && (
                          <button
                            className="btn btn-primary btn-xs"
                            style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettleTarget({
                                fromUserId: f.netBalance < 0 ? user._id : f.user._id,
                                toUserId: f.netBalance < 0 ? f.user._id : user._id,
                                fromName: f.netBalance < 0 ? (user.name + ' (you)') : f.user.name,
                                toName: f.netBalance < 0 ? f.user.name : (user.name + ' (you)'),
                                amount: Math.abs(f.netBalance).toFixed(2),
                                groups: f.groupBreakdown,
                                directBalance: f.directBalance,
                              });
                            }}
                          >
                            ⚡ Settle ₹{Math.abs(f.netBalance).toFixed(0)}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Secondary Bottom Section: Recent Activity Audit Feed */}
      <div className="card" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={16} style={{ color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Recent Activity & Settlement Audit</h3>
            <span className="badge badge-gray" style={{ fontSize: 10 }}>{recentExpenses.length} entries</span>
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setShowAllActivity(!showAllActivity)}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {showAllActivity ? (
              <>Show less <ChevronUp size={13} /></>
            ) : (
              <>Show full feed <ChevronDown size={13} /></>
            )}
          </button>
        </div>

        {loading ? (
          <div className="card animate-pulse" style={{ height: 60 }} />
        ) : recentExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No transaction records found yet
          </div>
        ) : (
          <div className="expenses-list">
            {(showAllActivity ? recentExpenses : recentExpenses.slice(0, 4)).map((exp) => {
              const paidById = (exp.paidBy?._id || exp.paidBy)?.toString();
              const isPayer = paidById === user._id;
              const mySplit = exp.splits?.find(
                (s) => (s.userId?._id || s.userId)?.toString() === user._id
              );
              const myShare = mySplit?.amount;

              const expDate = exp.date ? new Date(exp.date) : exp.createdAt ? new Date(exp.createdAt) : new Date();
              const dateStr = !isNaN(expDate.getTime()) ? format(expDate, 'MMM d') : '';

              // Context Badge
              let contextBadge = null;
              if (exp.groupId) {
                const gId = exp.groupId._id || exp.groupId;
                contextBadge = (
                  <Link to={`/groups/${gId}`} className="badge badge-gray" style={{ textDecoration: 'none', marginLeft: 6, fontSize: 10 }}>
                    {exp.groupId.icon || '🏠'} {exp.groupId.name}
                  </Link>
                );
              } else {
                const otherSplit = exp.splits?.find(
                  (s) => (s.userId?._id || s.userId)?.toString() !== user._id
                );
                const otherName = otherSplit?.userId?.name || (isPayer ? 'Friend' : exp.paidBy?.name);
                contextBadge = (
                  <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 10 }}>
                    👤 {otherName ? `with ${otherName}` : 'Direct Split'}
                  </span>
                );
              }

              if (exp.isSettlement) {
                const recipientName = exp.splits?.[0]?.userId?.name || 'Friend';
                const payerName = exp.paidBy?.name || 'Friend';
                return (
                  <div key={exp._id} className="expense-item" style={{ padding: '10px 12px' }}>
                    <div className="expense-category-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)' }}>
                      ✓
                    </div>
                    <div className="expense-details">
                      <div className="expense-description" style={{ fontSize: 13 }}>
                        {isPayer ? `Settlement to ${recipientName}` : `Settlement from ${payerName}`}
                      </div>
                      <div className="expense-meta" style={{ fontSize: 11 }}>
                        <span>{isPayer ? 'You paid' : `${payerName} paid you`} {dateStr ? `· ${dateStr}` : ''}</span>
                        {contextBadge}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="expense-amount" style={{ fontSize: 13, color: isPayer ? '#94a3b8' : 'var(--emerald)', fontWeight: 700 }}>
                        {isPayer ? '-' : '+'}₹{exp.totalAmount.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted" style={{ fontSize: 10 }}>Settled up</div>
                    </div>
                  </div>
                );
              }

              const displayAmount = isPayer
                ? (exp.totalAmount - (myShare || 0))
                : (myShare || exp.totalAmount);

              return (
                <div key={exp._id} className="expense-item" style={{ padding: '10px 12px' }}>
                  <div className="expense-category-icon">
                    {CATEGORY_EMOJIS[exp.category] || '📦'}
                  </div>
                  <div className="expense-details">
                    <div className="expense-description" style={{ fontSize: 13 }}>{exp.description}</div>
                    <div className="expense-meta" style={{ fontSize: 11 }}>
                      <span>Paid by {isPayer ? 'you' : (exp.paidBy?.name || 'Unknown')} {dateStr ? `· ${dateStr}` : ''}</span>
                      {contextBadge}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="expense-amount" style={{ fontSize: 13, color: isPayer ? 'var(--emerald)' : 'var(--rose)' }}>
                      {isPayer ? '+' : '-'}₹{displayAmount.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted" style={{ fontSize: 10 }}>₹{exp.totalAmount.toFixed(0)} total</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <AddExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSuccess={fetchData}
        />
      )}

      {/* Instant 1-Click Net Settle Modal */}
      {settleTarget && (
        <PeerSettleModal
          target={settleTarget}
          onClose={() => setSettleTarget(null)}
          onSuccess={fetchData}
        />
      )}

      {/* Friend Detail Breakdown Modal */}
      {inspectFriendId && (
        <FriendDetailModal
          friendId={inspectFriendId}
          onClose={() => setInspectFriendId(null)}
          onSettle={(target) => setSettleTarget(target)}
          onAddExpense={() => setShowExpenseModal(true)}
        />
      )}
    </div>
  );
};

export default Dashboard;
