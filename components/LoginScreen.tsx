
import React, { useState } from 'react';
import { Truck, Mail, Lock, ChevronRight, LogIn, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });
        if (signUpError) throw signUpError;
        alert("Solicitação de cadastro enviada! Verifique seu e-mail para confirmação.");
        setIsRegistering(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onLogin();
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0f172a] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20 mb-4 animate-bounce-slow">
            <Truck size={40} className="text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Concrete Router</h1>
          <p className="text-slate-400 text-xs uppercase tracking-[0.2em] mt-1 font-semibold">Logística Inteligente</p>
        </div>

        {/* Card */}
        <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isRegistering ? 'Solicitar Cadastro' : 'Acesse sua conta'}
          </h2>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">E-mail Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {!isRegistering && (
              <div className="flex justify-end">
                <button type="button" className="text-xs text-slate-500 hover:text-amber-500 transition-colors font-medium">Esqueceu a senha?</button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {isRegistering ? 'SOLICITAR CADASTRO' : 'ENTRAR NO SISTEMA'}
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {isRegistering ? (
                <span className="flex items-center gap-2 justify-center"><LogIn size={16} /> Já tem uma conta? Entre aqui</span>
              ) : (
                <span>Não tem acesso? <span className="text-amber-500 font-semibold">Solicite cadastro</span></span>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-600 text-[10px] font-medium tracking-[0.1em] uppercase">
          © 2025 Concrete Router Pro • v2.1.0
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
