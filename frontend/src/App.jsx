import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import FriendsPage from './pages/FriendsPage';
import { useState } from 'react';
import AddExpenseModal from './components/AddExpenseModal';

const ProtectedLayout = () => {
  const { user } = useAuth();
  const [showAddExpense, setShowAddExpense] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SocketProvider>
      <div className="app-layout">
        <Sidebar onAddExpense={() => setShowAddExpense(true)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        {showAddExpense && (
          <AddExpenseModal
            onClose={() => setShowAddExpense(false)}
            onSuccess={() => window.location.reload()}
          />
        )}
      </div>
    </SocketProvider>
  );
};

const AppRouter = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✂️</div>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <AuthPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0f0f0f',
              color: '#ededed',
              border: '1px solid #1f1f1f',
              borderRadius: '10px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#000' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#000' },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
