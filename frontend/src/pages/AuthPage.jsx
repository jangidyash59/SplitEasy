import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const AuthPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        toast.success('Welcome back! 👋');
      } else {
        await register(form.name, form.email, form.password);
        toast.success('Account created! 🎉');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">✂️</div>
          <div className="auth-logo-text">Split<span>Easy</span></div>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to manage your expenses'
            : 'Start splitting expenses with friends'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Aditya Kumar"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 16, height: 16 }} /> Processing...</>
            ) : (
              mode === 'login' ? 'Sign In →' : 'Create Account →'
            )}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <a onClick={() => setMode('register')}>Sign up</a>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <a onClick={() => setMode('login')}>Sign in</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
