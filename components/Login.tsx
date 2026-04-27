'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { LayoutDashboard, Lock, User, AlertCircle, ChevronDown } from 'lucide-react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

export const Login: React.FC = () => {
  const { login, setInitialPassword } = useAuth();
  const [settings, setSettings] = useState<{ name: string; logo: string | null }>({
    name: 'CondoDigital',
    logo: null
  });
  const [apartments, setApartments] = useState<string[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showForgotMsg, setShowForgotMsg] = useState(false);

  useEffect(() => {
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          name: data.name || 'CondoDigital',
          logo: data.logo || null
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/config'));

    const q = query(collection(db, 'apartments'), orderBy('number'));
    const unsubscribeApts = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => d.data().number);
      // Ensure 'admin' is in the list
      setApartments(['admin', ...list]);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'apartments'));

    return () => {
      unsubscribeSettings();
      unsubscribeApts();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUnit) {
      setError('Selecione uma unidade.');
      return;
    }

    if (isFirstLogin) {
      if (!password || !confirmPassword) {
        setError('Preencha e confirme sua nova senha.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        return;
      }
      if (password.length < 4) {
        setError('A senha deve ter pelo menos 4 caracteres.');
        return;
      }

      setIsLoggingIn(true);
      const setSuccess = await setInitialPassword(selectedUnit, password);
      if (setSuccess) {
        // Now login with the new password
        const result = await login(selectedUnit, password);
        if (!result.success) {
          setError('Erro ao realizar login após definir senha.');
          setIsLoggingIn(false);
        }
      } else {
        setError('Erro ao definir senha. Tente novamente.');
        setIsLoggingIn(false);
      }
      return;
    }

    if (!password && !isFirstLogin) {
      // We'll allow calling login with empty password to check if isFirstLogin
      setIsLoggingIn(true);
      const result = await login(selectedUnit, "");
      if (result.isFirstLogin) {
        setIsFirstLogin(true);
        setIsLoggingIn(false);
        return;
      }
      setError('Digite a senha.');
      setIsLoggingIn(false);
      return;
    }

    setIsLoggingIn(true);
    const result = await login(selectedUnit, password);
    
    if (result.isFirstLogin) {
      setIsFirstLogin(true);
      setPassword('');
      setIsLoggingIn(false);
      return;
    }

    if (!result.success) {
      setError('Senha incorreta ou unidade não encontrada.');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-3xl opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-100 border border-slate-100">
          <div className="mb-8 text-center">
            {settings.logo ? (
              <div className="h-20 w-auto flex items-center justify-center mx-auto mb-4">
                 <img src={settings.logo} alt="Logo" className="max-h-full object-contain" />
              </div>
            ) : (
              <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[1.5rem] mx-auto flex items-center justify-center text-white shadow-xl mb-4">
                <LayoutDashboard size={32} />
              </div>
            )}
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{settings.name}</h1>
            <p className="text-slate-400 text-sm font-medium mt-1">
              {isFirstLogin ? 'Definir Senha de Acesso' : 'Acesso ao Condomínio'}
            </p>
          </div>

          {isFirstLogin && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <p className="text-amber-700 text-xs font-bold leading-relaxed">
                Este é seu primeiro acesso. Por favor, crie uma senha para sua unidade para continuar.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Unidade / Perfil</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <User size={18} />
                </div>
                <select
                  disabled={isFirstLogin}
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-full pl-11 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all appearance-none text-slate-700 font-medium disabled:opacity-75"
                >
                  <option value="">Selecione sua unidade</option>
                  {apartments.map(apt => (
                    <option key={apt} value={apt}>{apt === 'admin' ? 'Administrador' : `Unidade ${apt}`}</option>
                  ))}
                </select>
                {!isFirstLogin && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <ChevronDown size={18} />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                {isFirstLogin ? 'Nova Senha' : 'Senha'}
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isFirstLogin ? "Crie uma senha forte" : "Sua senha de acesso"}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-700 font-medium placeholder:text-slate-300"
                />
              </div>
            </div>

            {isFirstLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Confirmar Senha</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-700 font-medium placeholder:text-slate-300"
                  />
                </div>
              </div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}

            <button
              disabled={isLoggingIn}
              type="submit"
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:grayscale"
            >
              {isLoggingIn ? (isFirstLogin ? 'Salvando...' : 'Entrando...') : (isFirstLogin ? 'Criar Senha e Entrar' : 'Entrar no Sistema')}
            </button>

            {isFirstLogin && (
              <button
                type="button"
                onClick={() => {
                  setIsFirstLogin(false);
                  setPassword('');
                  setConfirmPassword('');
                  setError('');
                }}
                className="w-full mt-2 text-center text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
              >
                Cancelar e Voltar
              </button>
            )}
          </form>

          <button
            onClick={() => setShowForgotMsg(true)}
            className="w-full mt-6 text-center text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors"
          >
            Esqueceu sua senha?
          </button>

          {showForgotMsg && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-[10px] uppercase tracking-widest font-black text-blue-600 text-center leading-relaxed"
            >
              Entre em contato com o síndico para recuperar ou redefinir seu acesso.
              <button 
                onClick={() => setShowForgotMsg(false)}
                className="block mx-auto mt-2 text-blue-400 hover:text-blue-800 underline"
              >
                Fechar aviso
              </button>
            </motion.div>
          )}
        </div>

        <p className="mt-8 text-[10px] text-slate-300 tracking-[0.2em] font-black uppercase text-center">
          v1.0.0 • CondoDigital Hub
        </p>
      </motion.div>
    </div>
  );
};
