import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Users, UserCheck, PlusCircle, LogOut, Bell, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const Sidebar = ({ onAddExpense }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const navItems = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/groups', icon: Users, label: 'Groups' },
    { to: '/friends', icon: UserCheck, label: 'Friends' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">✂️</div>
        <div className="sidebar-brand-text">Split<span>Easy</span></div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="icon" size={18} />
            {label}
          </NavLink>
        ))}

        <div className="divider" style={{ margin: '8px 0' }} />

        <button
          className="nav-item"
          onClick={onAddExpense}
          style={{ color: 'var(--emerald)', fontWeight: 600 }}
        >
          <PlusCircle className="icon" size={18} />
          Add Expense
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-icon btn-ghost"
            title="Logout"
            style={{ width: 28, height: 28, padding: 0 }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
