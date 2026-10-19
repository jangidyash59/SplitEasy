import { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { X, Search, Camera, Plus, Users, ChevronRight, Wand2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'food', emoji: '🍔', label: 'Food & Drink' },
  { value: 'transport', emoji: '🚗', label: 'Transport' },
  { value: 'accommodation', emoji: '🏠', label: 'Accommodation' },
  { value: 'entertainment', emoji: '🎬', label: 'Entertainment' },
  { value: 'utilities', emoji: '💡', label: 'Utilities' },
  { value: 'shopping', emoji: '🛍️', label: 'Shopping' },
  { value: 'health', emoji: '❤️', label: 'Health' },
  { value: 'other', emoji: '📦', label: 'Other' },
];

const GROUP_ICONS = ['🏠', '🌴', '✈️', '🍕', '🎉', '🎮', '🏋️', '💼', '🎓', '🚗'];

const AddExpenseModal = ({ onClose, onSuccess, defaultGroupId = null, defaultFriend = null }) => {
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────
  const [groups, setGroups] = useState([]);
  const [userDetails, setUserDetails] = useState(() => {
    const map = { [user._id]: { _id: user._id, name: user.name, email: user.email } };
    if (defaultFriend?._id) {
      map[defaultFriend._id] = defaultFriend;
    }
    return map;
  });

  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const searchRef = useRef(null);

  // Inline "Create Group" flow state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('🏠');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [form, setForm] = useState({
    description: '',
    totalAmount: '',
    groupId: defaultGroupId || '',
    category: 'other',
    splitType: 'EQUAL',
    involvedUserIds: defaultFriend?._id ? [user._id, defaultFriend._id] : [user._id],
    splitValues: [],
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  // ── Load groups on mount ───────────────────────────────────────────
  useEffect(() => {
    API.get('/api/groups').then((r) => setGroups(r.data.groups || [])).catch(() => {});
  }, []);

  // ── When group selection changes, populate members ─────────────────
  const prevGroupIdRef = useRef(form.groupId);
  useEffect(() => {
    if (form.groupId && form.groupId !== prevGroupIdRef.current) {
      const grp = groups.find((g) => g._id === form.groupId);
      if (grp && grp.members?.length) {
        const ids = grp.members.map((m) => m._id || m);
        const detailsMap = { ...userDetails };
        grp.members.forEach((m) => {
          if (m._id) detailsMap[m._id] = { _id: m._id, name: m.name, email: m.email };
        });
        setUserDetails(detailsMap);
        setForm((f) => ({ ...f, involvedUserIds: ids, splitValues: [] }));
      }
    }
    prevGroupIdRef.current = form.groupId;
  }, [form.groupId, groups, userDetails]);

  // ── User search with debounce ──────────────────────────────────────
  useEffect(() => {
    if (!form.groupId && userSearch.trim().length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const { data } = await API.get(`/api/auth/users/search?q=${encodeURIComponent(userSearch.trim())}`);
          setSearchResults(data.users || []);
        } catch {
          setSearchResults([]);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [userSearch, form.groupId]);

  // ── Add person to split ────────────────────────────────────────────
  const addPerson = (u) => {
    if (form.involvedUserIds.includes(u._id)) {
      toast('Already added!', { icon: 'ℹ️' });
      return;
    }
    setUserDetails((prev) => ({ ...prev, [u._id]: u }));
    setForm((f) => ({
      ...f,
      involvedUserIds: [...f.involvedUserIds, u._id],
      splitValues: [],
    }));
    setUserSearch('');
    setSearchResults([]);
  };

  const removePerson = (uid) => {
    if (uid === user._id) return;
    setForm((f) => ({
      ...f,
      involvedUserIds: f.involvedUserIds.filter((id) => id !== uid),
      splitValues: [],
    }));
  };

  // ── Inline group creation ──────────────────────────────────────────
  const handleCreateGroupInline = async () => {
    if (!newGroupName.trim()) { toast.error('Enter a group name'); return; }
    setCreatingGroup(true);
    try {
      const memberIds = form.involvedUserIds.filter((id) => id !== user._id);
      const { data } = await API.post('/api/groups', {
        name: newGroupName.trim(),
        icon: newGroupIcon,
        memberIds,
      });
      const { data: grpData } = await API.get('/api/groups');
      setGroups(grpData.groups || []);
      setForm((f) => ({ ...f, groupId: data.group._id }));
      setShowCreateGroup(false);
      setNewGroupName('');
      toast.success(`Group "${data.group.name}" created! 🎉`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // ── Receipt & Payment Screenshot Scan ──────────────────────────────
  const handleReceiptScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanLoading(true);
    const toastId = toast.loading('🔍 Scanning with Gemini Vision AI...');
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const { data } = await API.post('/api/receipt/scan', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      if (data.success && data.receipt) {
        const amt = data.receipt.totalAmount;
        const name = (data.receipt.storeName && data.receipt.storeName !== 'Unknown')
          ? data.receipt.storeName
          : (data.receipt.items?.[0]?.name || '');

        setForm((f) => ({
          ...f,
          description: name || f.description || 'Payment',
          totalAmount: amt > 0 ? amt.toString() : f.totalAmount,
        }));
        toast.dismiss(toastId);
        toast.success(`📄 Scanned! ${name ? name + ' — ' : ''}₹${amt}`);
      } else {
        toast.dismiss(toastId);
        toast.error('Could not detect amount from image. Please enter manually.');
      }
    } catch (err) {
      console.error('Receipt scan error:', err);
      toast.dismiss(toastId);
      toast.error(err.response?.data?.message || 'Receipt scan failed: ' + (err.message || 'timed out'));
    } finally {
      setScanLoading(false);
      e.target.value = '';
    }
  };

  // ── Auto-fill Remainder Helper ──────────────────────────────────────
  const totalAmt = parseFloat(form.totalAmount) || 0;
  const peopleCount = form.involvedUserIds.length;

  const currentValuesSum = form.splitValues.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const exactRemaining = Math.max(0, totalAmt - currentValuesSum);
  const percentRemaining = Math.max(0, 100 - currentValuesSum);

  const handleAutoFillRemainder = (idx) => {
    const vals = [...form.splitValues];
    // Fill all previous indexes with what they have or 0
    for (let i = 0; i < form.involvedUserIds.length; i++) {
      if (vals[i] === undefined || vals[i] === '') vals[i] = 0;
    }
    if (form.splitType === 'EXACT') {
      const sumWithoutThis = vals.reduce((s, v, i) => i === idx ? s : s + (parseFloat(v) || 0), 0);
      vals[idx] = Math.max(0, totalAmt - sumWithoutThis).toFixed(2);
    } else if (form.splitType === 'PERCENTAGE') {
      const sumWithoutThis = vals.reduce((s, v, i) => i === idx ? s : s + (parseFloat(v) || 0), 0);
      vals[idx] = Math.max(0, 100 - sumWithoutThis).toFixed(1);
    }
    setForm((f) => ({ ...f, splitValues: vals }));
  };

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    const amount = parseFloat(form.totalAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (form.involvedUserIds.length === 0) { toast.error('Add at least one person'); return; }

    if (form.splitType !== 'EQUAL') {
      const vals = form.splitValues.map(Number);
      if (vals.some(isNaN) || vals.length !== form.involvedUserIds.length) {
        toast.error('Fill in split values for everyone'); return;
      }
      if (form.splitType === 'PERCENTAGE') {
        const sum = vals.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) > 0.5) { toast.error(`Percentages must sum to 100 (got ${sum.toFixed(1)})`); return; }
      }
      if (form.splitType === 'EXACT') {
        const sum = vals.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - amount) > 0.5) { toast.error(`Exact amounts must sum to ₹${amount} (got ₹${sum.toFixed(2)})`); return; }
      }
    }

    setLoading(true);
    try {
      const payload = {
        description: form.description.trim(),
        totalAmount: amount,
        paidBy: user._id,
        groupId: form.groupId || undefined,
        splitType: form.splitType,
        involvedUserIds: form.involvedUserIds,
        splitValues: form.splitType !== 'EQUAL' ? form.splitValues.map(Number) : [],
        category: form.category,
        notes: form.notes,
        date: form.date,
      };
      await API.post('/api/expenses', payload);
      toast.success('Expense added! 🎉');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  // ── Computed values ────────────────────────────────────────────────
  const amountPerPerson = peopleCount > 0 && totalAmt > 0
    ? (totalAmt / peopleCount).toFixed(2)
    : '0.00';

  const getUserName = (uid) => {
    const u = userDetails[uid];
    if (!u) return uid === user._id ? user.name : 'Unknown';
    return u.name;
  };

  const showAddPeople = !form.groupId;
  const showInlineGroupPrompt = !form.groupId && form.involvedUserIds.length >= 2;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">✂️ Add Expense</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Receipt / Payment Scanner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <label
              htmlFor="receipt-upload"
              className="btn btn-ghost btn-sm"
              style={{ cursor: 'pointer', border: '1px solid var(--border)' }}
            >
              <Camera size={14} />
              {scanLoading ? 'Scanning…' : 'Scan Receipt / Payment Screenshot (AI)'}
            </label>
            <input
              id="receipt-upload"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleReceiptScan}
              disabled={scanLoading}
            />
            <span className="text-xs text-muted">Supports GPay, Paytm, Bills & Invoices</span>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description *</label>
            <input
              className="form-input"
              placeholder="Dinner, Groceries, Hotel, Rent…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Amount + Category */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={form.totalAmount}
                onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              className="form-input"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          {/* Group selector */}
          <div className="form-group">
            <label className="form-label">Group (optional)</label>
            <select
              className="form-select"
              value={form.groupId}
              onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
            >
              <option value="">— No group (individual / direct expense) —</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>{g.icon} {g.name} ({g.members?.length} members)</option>
              ))}
            </select>
          </div>

          {/* Split type */}
          <div className="form-group">
            <label className="form-label">Split Type</label>
            <div className="split-type-grid">
              {['EQUAL', 'EXACT', 'PERCENTAGE'].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`split-type-btn ${form.splitType === type ? 'active' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, splitType: type, splitValues: [] }))}
                >
                  {type === 'EQUAL' ? '⚖️ Equal' : type === 'EXACT' ? '💰 Exact' : '% Percent'}
                </button>
              ))}
            </div>
          </div>

          {/* Add people (individual non-group only) */}
          {showAddPeople && (
            <div className="form-group">
              <label className="form-label">Add People to Split</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
                }} />
                <input
                  ref={searchRef}
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Search registered user by name or email…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  marginTop: 4,
                  boxShadow: 'var(--shadow)',
                }}>
                  {searchResults.map((u) => {
                    const alreadyAdded = form.involvedUserIds.includes(u._id);
                    return (
                      <div
                        key={u._id}
                        onClick={() => !alreadyAdded && addPerson(u)}
                        style={{
                          padding: '10px 14px',
                          cursor: alreadyAdded ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          borderBottom: '1px solid var(--border)',
                          opacity: alreadyAdded ? 0.5 : 1,
                          background: 'transparent',
                          transition: 'var(--transition)',
                        }}
                        onMouseEnter={(e) => { if (!alreadyAdded) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 12, flexShrink: 0 }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                          <div className="text-xs text-muted">{u.email}</div>
                        </div>
                        {alreadyAdded
                          ? <span className="badge badge-green" style={{ fontSize: 10 }}>Added ✓</span>
                          : <Plus size={14} style={{ color: 'var(--emerald)', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* People involved */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Splitting between <strong style={{ color: 'var(--text-primary)' }}>{peopleCount}</strong> {peopleCount === 1 ? 'person' : 'people'}
              </label>
              {form.splitType === 'EQUAL' && totalAmt > 0 && (
                <span style={{ color: 'var(--emerald)', fontWeight: 700, fontSize: 13 }}>
                  ₹{amountPerPerson} each
                </span>
              )}
              {form.splitType === 'EXACT' && totalAmt > 0 && (
                <span style={{ fontSize: 12, color: exactRemaining === 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                  {exactRemaining === 0 ? 'Balanced ✓' : `Remaining: ₹${exactRemaining.toFixed(2)}`}
                </span>
              )}
              {form.splitType === 'PERCENTAGE' && (
                <span style={{ fontSize: 12, color: percentRemaining === 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                  {percentRemaining === 0 ? 'Balanced 100% ✓' : `Remaining: ${percentRemaining.toFixed(1)}%`}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.involvedUserIds.map((uid, idx) => {
                const name = getUserName(uid);
                const isCurrentUser = uid === user._id;
                return (
                  <div
                    key={uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '9px 12px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 12, flexShrink: 0 }}>
                      {name[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {name}
                        {isCurrentUser && <span className="badge badge-green" style={{ fontSize: 10, marginLeft: 6 }}>you</span>}
                      </span>
                    </div>

                    {/* Split value inputs for EXACT / PERCENTAGE */}
                    {form.splitType !== 'EQUAL' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          placeholder={form.splitType === 'PERCENTAGE' ? '0%' : '₹0'}
                          min="0"
                          step="0.01"
                          style={{
                            width: 80,
                            padding: '5px 8px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            fontFamily: 'inherit',
                            outline: 'none',
                            flexShrink: 0,
                          }}
                          value={form.splitValues[idx] ?? ''}
                          onChange={(e) => {
                            const vals = [...form.splitValues];
                            vals[idx] = e.target.value;
                            setForm((f) => ({ ...f, splitValues: vals }));
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost"
                          title="Auto-fill remainder"
                          style={{ width: 26, height: 26, padding: 0 }}
                          onClick={() => handleAutoFillRemainder(idx)}
                        >
                          <Wand2 size={12} style={{ color: 'var(--emerald)' }} />
                        </button>
                      </div>
                    )}

                    {/* Equal amount preview */}
                    {form.splitType === 'EQUAL' && totalAmt > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                        ₹{amountPerPerson}
                      </span>
                    )}

                    {!isCurrentUser && !form.groupId && (
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost"
                        style={{ width: 26, height: 26, flexShrink: 0 }}
                        onClick={() => removePerson(uid)}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Inline Group Creation Prompt ─────────────────────────────── */}
          {showInlineGroupPrompt && !showCreateGroup && (
            <div style={{
              background: 'var(--emerald-glow)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 10,
            }}>
              <Users size={18} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--emerald)' }}>
                  Split with multiple people?
                </div>
                <div className="text-xs text-muted">
                  You can organize these friends into a group right here.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateGroup(true)}
              >
                Create Group <ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* Inline Create Group Form */}
          {showCreateGroup && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 16,
              marginTop: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>New Group for These Members</div>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost"
                  style={{ width: 24, height: 24 }}
                  onClick={() => setShowCreateGroup(false)}
                >
                  <X size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {GROUP_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewGroupIcon(icon)}
                    style={{
                      fontSize: 18,
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: newGroupIcon === icon ? '2px solid var(--emerald)' : '1px solid var(--border)',
                      background: newGroupIcon === icon ? 'var(--emerald-glow)' : 'var(--bg-card)',
                      cursor: 'pointer',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Group name (e.g. Goa Trip, Flatmates…)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGroupInline()}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateGroupInline}
                  disabled={creatingGroup}
                  style={{ flexShrink: 0 }}
                >
                  {creatingGroup ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding…' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddExpenseModal;
