'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Home, Plus, Trash2, Search, X, Lock, AlertCircle, Edit2, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export const ApartmentsView: React.FC = () => {
  const { isAdmin, isSindico } = useAuth();
  const [apartments, setApartments] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ number: '', block: '', floor: '', password: '' });

  useEffect(() => {
    const qApts = query(collection(db, 'apartments'), orderBy('number'));
    
    // Listen to units
    const unsubApts = onSnapshot(qApts, (snapshot) => {
      const apts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApartments(prev => {
        // Merge with existing password data if already loaded
        return apts.map(apt => {
          const existing = prev.find(p => p.id === apt.id);
          return { ...apt, password: existing?.password || '' };
        });
      });
    }, (err) => handleFirestoreError(err, OperationType.GET, 'apartments'));

    // Listen to passwords separately for real-time reactivity
    const unsubPasswords = onSnapshot(collection(db, 'unit_passwords'), (snapshot) => {
      const pwMap: { [key: string]: string } = {};
      snapshot.docs.forEach(doc => {
        pwMap[doc.id] = doc.data().password;
      });

      setApartments(prev => prev.map(apt => ({
        ...apt,
        password: pwMap[apt.number] || ''
      })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'unit_passwords'));

    return () => {
      unsubApts();
      unsubPasswords();
    };
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const apartmentData = {
        number: form.number,
        block: form.block,
        floor: form.floor
      };

      if (editingId) {
        await updateDoc(doc(db, 'apartments', editingId), apartmentData);
        showAlert("Sucesso", "Unidade atualizada.", "success");
      } else {
        await addDoc(collection(db, 'apartments'), apartmentData);
        await setDoc(doc(db, 'unit_passwords', form.number), { password: form.password });
        showAlert("Sucesso", "Unidade cadastrada com sucesso.", "success");
      }
      resetForm();
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao salvar unidade.", "danger");
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({ number: '', block: '', floor: '', password: '' });
  };

  const startEdit = (apt: any) => {
    setForm({ 
      number: apt.number, 
      block: apt.block || '', 
      floor: apt.floor || '', 
      password: apt.password || '' 
    });
    setEditingId(apt.id);
    setIsAdding(true);
  };

  const [alertConfig, setAlertConfig] = useState<{ 
    show: boolean, 
    title: string, 
    message: string, 
    type: 'info' | 'danger' | 'success', 
    onConfirm?: () => void 
  } | null>(null);

  const showAlert = (title: string, message: string, type: 'info' | 'danger' | 'success' = 'info', onConfirm?: () => void) => {
    setAlertConfig({ show: true, title, message, type, onConfirm });
  };

  const closeAlert = () => setAlertConfig(null);

  const handleDelete = async (id: string, number: string) => {
    showAlert(
      "Confirmar Exclusão",
      `Deseja remover a unidade ${number}? Esta ação excluirá permanentemente a unidade e suas credenciais.`,
      'danger',
      async () => {
        try {
          await deleteDoc(doc(db, 'apartments', id));
          await deleteDoc(doc(db, 'unit_passwords', number));
          showAlert("Sucesso", "Unidade removida com sucesso.", "success");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `apartments/${id}`);
          showAlert("Erro", "Ocorreu uma falha ao tentar excluir a unidade.", "danger");
        }
      }
    );
  };

  const handleResetPassword = async () => {
    if (!form.number) {
      showAlert("Erro", "Número da unidade não identificado.", "info");
      return;
    }
    
    showAlert(
      "Resetar Senha",
      `Deseja REALMENTE apagar a senha da unidade ${form.number}? Esta operação é definitiva e removerá o acesso atual.`,
      'danger',
      async () => {
        try {
          await setDoc(doc(db, 'unit_passwords', form.number), { 
            password: '',
            updatedAt: new Date(),
            clearedBy: isAdmin ? 'admin' : 'sindico'
          });
          
          showAlert("Sucesso", "Senha apagada com sucesso! O acesso foi resetado.", "success");
          resetForm();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `unit_passwords/${form.number}`);
          showAlert("Falha", "Não foi possível apagar a senha. Verifique suas permissões.", "danger");
        }
      }
    );
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Apartamentos</h1>
          <p className="text-slate-500 mt-2">Gestão de unidades e senhas de acesso.</p>
        </div>
        {(isAdmin || isSindico) && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-100"
          >
            <Plus size={20} /> Nova Unidade
          </button>
        )}
      </header>

      {isAdding && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={resetForm} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900">
                  {editingId ? 'Editar Unidade' : 'Cadastro de Unidade'}
                </h3>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Número da Unidade</label>
                  <input 
                    required 
                    disabled={!!editingId}
                    placeholder="Ex: 101, 202A..." 
                    className={cn(
                      "w-full px-4 py-3 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all",
                      editingId ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-50 focus:bg-white"
                    )}
                    value={form.number} 
                    onChange={e => setForm({...form, number: e.target.value})} 
                  />
                  {editingId && <p className="text-[10px] text-slate-400 px-1 italic">Número da unidade não pode ser alterado na edição.</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Bloco</label>
                    <input placeholder="Ex: A, B" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={form.block} onChange={e => setForm({...form, block: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Andar</label>
                    <input placeholder="Ex: 1, 2" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Senha de Acesso</label>
                  <div className="relative group">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      required={!editingId}
                      type="text" 
                      disabled={!!editingId}
                      placeholder={editingId ? (form.password ? "Senha Protegida" : "Senha não definida") : "Defina uma senha"} 
                      className={cn(
                        "w-full pl-11 pr-4 py-3 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono",
                        editingId ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white focus:bg-slate-50",
                        editingId && !form.password && "text-slate-300 italic"
                      )}
                      value={editingId ? (form.password ? "••••••••" : "Não definida") : form.password} 
                      onChange={e => !editingId && setForm({...form, password: e.target.value})} 
                    />
                  </div>
                  
                  {editingId ? (
                    <div className="pt-2">
                      <button 
                        type="button"
                        onClick={handleResetPassword}
                        className={cn(
                          "w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all border uppercase tracking-wider shadow-sm",
                          form.password 
                            ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100 active:scale-95" 
                            : "bg-slate-50 text-slate-400 border-slate-100 opacity-60"
                        )}
                      >
                        <KeyRound size={16} /> {form.password ? 'Apagar Senha Atual' : 'Resetar (Senha já vazia)'}
                      </button>
                      <p className="text-[10px] text-slate-400 font-medium px-1 mt-2 text-center italic">
                        {form.password ? "A senha atual será removida e o acesso resetado." : "Unidade sem senha cadastrada no momento."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium px-1">Esta senha será usada por todos os moradores desta unidade.</p>
                  )}
                </div>

                <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Unidade'}
                </button>
              </form>
            </motion.div>
         </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {apartments.map(apt => (
          <div key={apt.id} className="relative bg-white p-6 rounded-3xl border border-slate-100 text-center group hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-default">
            <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Home size={28} />
            </div>
            <p className="font-black text-xl text-slate-900">{apt.number}</p>
            <div className="flex flex-col items-center gap-0.5 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{apt.block || 'S/B'}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{apt.floor || 'S/A'}</span>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-center gap-1.5 overflow-hidden">
               <Lock size={10} className="text-slate-300 shrink-0" />
               <p className="text-[10px] font-mono text-slate-400 truncate">{apt.password ? '•••••' : 'Não definida'}</p>
            </div>

            {(isAdmin || isSindico) && (
              <div className="absolute top-3 right-3 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => startEdit(apt)}
                  className="p-2 bg-white text-slate-400 hover:text-blue-600 rounded-lg shadow-sm hover:shadow-md transition-all border border-slate-100"
                  title="Editar unidade e senha"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(apt.id, apt.number)}
                  className="p-2 bg-white text-slate-400 hover:text-red-500 rounded-lg shadow-sm hover:shadow-md transition-all border border-slate-100"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {alertConfig?.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAlert}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className={cn(
                "p-6 text-center",
                alertConfig.type === 'danger' ? "bg-red-50 text-red-600" : 
                alertConfig.type === 'success' ? "bg-green-50 text-green-600" : 
                "bg-blue-50 text-blue-600"
              )}>
                <div className="mx-auto w-12 h-12 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
                  {alertConfig.type === 'danger' ? <AlertCircle size={24} /> : 
                   alertConfig.type === 'success' ? <KeyRound size={24} /> : 
                   <AlertCircle size={24} />}
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">{alertConfig.title}</h3>
              </div>
              
              <div className="p-8 text-center">
                <p className="text-slate-600 font-medium leading-relaxed">{alertConfig.message}</p>
                
                <div className="mt-8 flex flex-col gap-3">
                  {alertConfig.onConfirm ? (
                    <>
                      <button 
                        onClick={() => {
                          alertConfig.onConfirm?.();
                          closeAlert();
                        }}
                        className={cn(
                          "w-full py-4 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95",
                          alertConfig.type === 'danger' ? "bg-red-600 shadow-red-100 hover:bg-red-700" : "bg-blue-600 shadow-blue-100 hover:bg-blue-700"
                        )}
                      >
                        Confirmar
                      </button>
                      <button 
                        onClick={closeAlert}
                        className="w-full py-4 bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={closeAlert}
                      className="w-full py-4 bg-slate-900 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-slate-100 hover:bg-slate-800 transition-all active:scale-95"
                    >
                      Entendido
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
