import { useState } from 'react';
import API from '../api/axios';
import { ArrowRight, X, Check, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const PeerSettleModal = ({ target, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  if (!target) return null;

  const handleSettle = async () => {
    setLoading(true);
    try {
      await API.post('/api/expenses/settle', {
        fromUserId: target.fromUserId,
        toUserId: target.toUserId,
        amount: parseFloat(target.amount),
        // No groupId indicates global net settlement across all shared groups & direct payments
      });
      toast.success(`Settlement of ₹${Number(target.amount).toFixed(0)} completed! Both accounts updated.`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settlement failed');
    } finally {
      setLoading(false);
    }
  };

  const groupCount = target.groups?.length || 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--emerald)' }}>⚡</span> Instant Net Settle
          </h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)',
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            marginBottom: 12,
          }}>
            <ShieldCheck size={13} /> Single Point of Settlement
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, margin: '10px 0',
          }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{target.fromName}</span>
            <ArrowRight size={16} style={{ color: 'var(--emerald)' }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{target.toName}</span>
          </div>

          <div style={{
            fontSize: 38, fontWeight: 800, color: 'var(--emerald)',
            margin: '8px 0 14px 0', letterSpacing: '-0.02em',
          }}>
            ₹{Number(target.amount).toFixed(2)}
          </div>

          {target.groups && target.groups.length > 0 && (
            <div style={{
              background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              borderRadius: 8, padding: '10px 14px', marginBottom: 14, textAlign: 'left',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Reconciles debts across:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {target.groups.map((g) => (
                  <span key={g.groupId || g.groupName} className="badge badge-gray" style={{ fontSize: 11 }}>
                    {g.groupIcon || '🏠'} {g.groupName} ({g.balance > 0 ? '+' : ''}₹{Math.abs(g.balance).toFixed(0)})
                  </span>
                ))}
                {target.directBalance && Math.abs(target.directBalance) > 0.01 && (
                  <span className="badge badge-blue" style={{ fontSize: 11 }}>
                    📱 Direct Splits ({target.directBalance > 0 ? '+' : ''}₹{Math.abs(target.directBalance).toFixed(0)})
                  </span>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-muted" style={{ margin: '0 auto', maxWidth: 320, lineHeight: 1.5 }}>
            This clears the balance between you both across {groupCount > 0 ? `${groupCount} shared group${groupCount > 1 ? 's' : ''} and ` : ''}direct splits, and notifies both members by email.
          </p>
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSettle} disabled={loading}>
            {loading ? 'Settling…' : 'Confirm & Settle Now ✓'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PeerSettleModal;
