'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [form, setForm]     = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [loading, setLoading] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Signup failed'); return; }
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('workspaceId', String(data.data.workspaceId));
      toast.success('Account created! Welcome 🎉');
      // Hard redirect so the browser sends the auth cookie to middleware
      setTimeout(() => { window.location.href = '/dashboard'; }, 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-whatsapp-dark to-whatsapp-teal flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💬</div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Start sending WhatsApp campaigns today</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Full Name', name: 'name', type: 'text', placeholder: 'John Doe' },
            { label: 'Email', name: 'email', type: 'email', placeholder: 'you@company.com' },
            { label: 'Password', name: 'password', type: 'password', placeholder: 'Min 8 characters' },
            { label: 'Business Name', name: 'workspaceName', type: 'text', placeholder: 'Acme Corp' },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type} name={f.name} required
                value={form[f.name as keyof typeof form]}
                onChange={onChange}
                className="input" placeholder={f.placeholder}
              />
            </div>
          ))}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-whatsapp-teal font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
