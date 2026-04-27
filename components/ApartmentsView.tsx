'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Home, Plus, Trash2, Search, X, Lock, AlertCircle, Edit2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export const ApartmentsView: React.FC = () => {
  const { isAdmin, isSindico } = useAuth();
  const [apartments, setApartments] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ number: '', block: '', floor: '', password: '' });

  useEffect(() => {
    const q = query(collection(db, 'apartments'), orderBy('number'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const apts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Fetch passwords for these units
      const withPasswords = await Promise.all(apts.map(async (apt: any) => {
        try {
          const pDoc = await getDoc(doc(db, 'unit_passwords', apt.number));
          return { ...apt, password: pDoc.exists() ? pDoc.data()?.password : '' };
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `unit_passwords/${apt.number}`);
          return { ...apt, password: '' };
        }
      }));
      
      setApartments(withPasswords);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'apartments'));
    return () => unsubscribe();
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
        // Update password in the separate collection
        await setDoc(doc(db, 'unit_passwords', form.number), { password: form.password });
        alert("Unidade e senha atualizadas.");
      } else {
        await addDoc(collection(db, 'apartments'), apartmentData);
        await setDoc(doc(db, 'unit_passwords', form.number), { password: form.password });
        alert("Unidade cadastrada com sucesso.");
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar unidade.");
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

  const handleDelete = async (id: string, number: string) => {
    if (confirm("Deseja remover esta unidade? As credenciais de acesso também serão removidas.")) {
      await deleteDoc(doc(db, 'apartments', id));
      await deleteDoc(doc(db, 'unit_passwords', number));
    }
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
                  <input required placeholder="Ex: 101, 202A..." className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={form.number} onChange={e => setForm({...form, number: e.target.value})} />
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
                      required
                      type="text" 
                      placeholder="Defina uma senha" 
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono" 
                      value={form.password} 
                      onChange={e => setForm({...form, password: e.target.value})} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium px-1">Esta senha será usada por todos os moradores desta unidade.</p>
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
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{apt.block ? `Bloco ${apt.block}` : 'S/B'}</span>
              <span className="w-1 h-1 bg-slate-200 rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{apt.floor ? `${apt.floor}º Andar` : 'S/A'}</span>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-center gap-1.5 overflow-hidden">
               <Lock size={10} className="text-slate-300 shrink-0" />
               <p className="text-[10px] font-mono text-slate-400 truncate">{apt.password ? '•••••' : 'Não definida'}</p>
            </div>

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
          </div>
        ))}
      </div>
    </div>
  );
};
