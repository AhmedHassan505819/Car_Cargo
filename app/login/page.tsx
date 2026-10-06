'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { login, signup } from './actions';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    
    const formData = new FormData(e.currentTarget);
    formData.append('redirectUrl', redirectUrl);
    
    // Auto-detect role from the URL if we are signing up from landing page
    if (!isLogin && !formData.has('role')) {
      formData.append('role', redirectUrl.includes('rider') ? 'rider' : 'sender');
    }

    const action = isLogin ? login : signup;
    
    try {
      const res = await action(formData);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setSuccessMsg(res.success);
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-8 w-full max-w-md space-y-6 z-10 relative overflow-hidden">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
          {isLogin ? 'Welcome Back' : 'Join BBA Transport'}
        </h1>
        <p className="text-[#9ca3af]">
          {isLogin ? 'Enter your credentials to continue' : 'Create an account to start'}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-3 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-[#9ca3af] mb-1">Full Name</label>
            <input 
              name="fullName"
              type="text" 
              required
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="John Doe"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#9ca3af] mb-1">Email</label>
          <input 
            name="email"
            type="email" 
            required
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#9ca3af] mb-1">Password</label>
          <input 
            name="password"
            type="password" 
            required
            minLength={6}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
        >
          {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
        </button>
      </form>

      <div className="text-center pt-2">
        <button 
          type="button"
          onClick={() => { setIsLogin(!isLogin); setError(null); }}
          className="text-sm text-[#9ca3af] hover:text-white transition-colors"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

      <Suspense fallback={
        <div className="glass-panel p-8 w-full max-w-md flex items-center justify-center z-10 relative min-h-[400px]">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
