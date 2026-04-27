'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, serverTimestamp, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Users, Search, Phone, Mail, Home, ShieldCheck, ShieldAlert, Plus, X, UserCheck, UserMinus, Lock, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

type ResidentType = 'Proprietário' | 'Morador' | 'Inquilino';

export const ResidentsView: React.FC = () => {
  const { isAdmin, isSindico } = useAuth();
  const [residents, setResidents] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    apartmentId: '',
    phoneNumber: '',
    residentType: 'Morador' as ResidentType,
    isSindico: false,
    isNonResident: false
  });

  useEffect(() => {
    const q = query(collection(db, 'residents'), orderBy('apartmentId'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'residents'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'apartments'), orderBy('number'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setApartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'apartments'));
    return () => unsubscribe();
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.apartmentId) {
      alert("Selecione um apartamento.");
      return;
    }
    
    try {
      // Uniqueness logic for Síndico: If marking current as Síndico, remove status from others
      if (form.isSindico) {
        const currentSindicos = residents.filter(r => r.isSindico && r.id !== editingId);
        for (const s of currentSindicos) {
          await updateDoc(doc(db, 'residents', s.id), { isSindico: false });
        }
      }

      const residentData = {
        ...form,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'residents', editingId), residentData);
        alert("Morador atualizado com sucesso!");
      } else {
        await addDoc(collection(db, 'residents'), {
          ...residentData,
          role: 'resident',
          createdAt: serverTimestamp()
        });
        alert("Morador cadastrado com sucesso!");
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar morador.");
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({
      name: '',
      email: '',
      apartmentId: '',
      phoneNumber: '',
      residentType: 'Morador',
      isSindico: false,
      isNonResident: false
    });
  };

  const startEdit = (resident: any) => {
    setForm({
      name: resident.name || '',
      email: resident.email || '',
      apartmentId: resident.apartmentId || '',
      phoneNumber: resident.phoneNumber || '',
      residentType: resident.residentType || 'Morador',
      isSindico: resident.isSindico || false,
      isNonResident: resident.isNonResident || false
    });
    setEditingId(resident.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir o morador ${name}?`)) {
      try {
        await deleteDoc(doc(db, 'residents', id));
        alert("Morador removido com sucesso.");
      } catch (error) {
        console.error(error);
        alert("Erro ao excluir morador.");
      }
    }
  };

  const formatPhone = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
      v = v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (v.length > 5) {
      v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else if (v.length > 2) {
      v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    } else if (v.length > 0) {
      v = v.replace(/^(\d*)/, "($1");
    }
    return v;
  };

  const filtered = residents.filter(r => {
    const matchesSearch = (
      r.name?.toLowerCase().includes(search.toLowerCase()) || 
      r.apartmentId?.toLowerCase().includes(search.toLowerCase())
    );
    return matchesSearch;
  }).sort((a, b) => {
    // Primary sort: Apartment ID
    if (a.apartmentId < b.apartmentId) return -1;
    if (a.apartmentId > b.apartmentId) return 1;

    // Secondary sort: Resident Type Weight
    const getWeight = (type: string) => {
      switch (type) {
        case 'Proprietário': return 0;
        case 'Morador': return 1;
        case 'Inquilino': return 2;
        default: return 3;
      }
    };
    
    return getWeight(a.residentType) - getWeight(b.residentType);
  });

  if (!isAdmin && !isSindico) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 min-h-[80vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md text-center"
        >
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-slate-500 text-sm mt-2">Esta área é exclusiva para a administração do condomínio.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Moradores</h1>
          <p className="text-slate-500 mt-2">Gerencie moradores e permissões do condomínio.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:w-64">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              placeholder="Buscar..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            <Plus size={20} /> Novo Morador
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
               onClick={() => setIsAdding(false)} 
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="relative bg-white p-8 rounded-3xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]"
             >
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-2xl font-bold text-slate-900">
                   {editingId ? 'Editar Morador' : 'Cadastrar Morador'}
                 </h3>
                 <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                 </button>
               </div>

               <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Apartamento</label>
                     <select 
                        required
                        className="w-full px-4 py-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.apartmentId}
                        onChange={e => setForm({...form, apartmentId: e.target.value})}
                     >
                       <option value="">Selecione...</option>
                       {apartments.map(apt => (
                         <option key={apt.id} value={apt.number}>{apt.number}</option>
                       ))}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Completo</label>
                     <input 
                        required 
                        placeholder="Nome" 
                        className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                     />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Morador</label>
                     <select 
                        required
                        className="w-full px-4 py-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.residentType}
                        onChange={e => setForm({...form, residentType: e.target.value as ResidentType})}
                     >
                       <option value="Proprietário">Proprietário</option>
                       <option value="Morador">Morador</option>
                       <option value="Inquilino">Inquilino</option>
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                     <input 
                        placeholder="(00) 00000-0000" 
                        className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        value={form.phoneNumber} 
                        onChange={e => setForm({...form, phoneNumber: formatPhone(e.target.value)})} 
                     />
                   </div>
                 </div>

                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                   <input 
                      type="email"
                      required
                      placeholder="email@exemplo.com" 
                      className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})} 
                   />
                 </div>

                 <div className="flex flex-wrap gap-6 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={form.isSindico} 
                          onChange={e => setForm({...form, isSindico: e.target.checked})} 
                        />
                        <div className={`w-10 h-6 rounded-full transition-all ${form.isSindico ? 'bg-blue-600' : 'bg-slate-200'}`} />
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${form.isSindico ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">Síndico</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={form.isNonResident} 
                          onChange={e => setForm({...form, isNonResident: e.target.checked})} 
                        />
                        <div className={`w-10 h-6 rounded-full transition-all ${form.isNonResident ? 'bg-blue-600' : 'bg-slate-200'}`} />
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${form.isNonResident ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">Não Residente</span>
                    </label>
                 </div>

                 <button type="submit" className="w-full py-4 mt-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all">
                    Finalizar Cadastro
                 </button>
               </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
              <th className="px-6 py-4">Morador</th>
              <th className="px-6 py-4">Unidade</th>
              <th className="px-6 py-4">Perfil</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center font-bold",
                      r.isSindico ? "bg-indigo-100 text-indigo-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {r.name ? r.name[0] : '?'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-none mb-1 flex items-center gap-2">
                        {r.name}
                        {r.isSindico && <ShieldCheck size={14} className="text-indigo-500" />}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5"><Mail size={12} className="opacity-60" /> {r.email}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5"><Phone size={12} className="opacity-60" /> {r.phoneNumber || 'Não cadastrado'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700">Apto {r.apartmentId}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                      {r.isNonResident ? 'Não Residente' : 'Residente'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    {r.residentType}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {r.role === 'admin' && (
                      <span className="w-fit px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-900 text-white uppercase">
                        Admin
                      </span>
                    )}
                    {r.isSindico && (
                      <span className="w-fit px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-600 text-white uppercase">
                        Síndico
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => startEdit(r)}
                      title="Editar"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(r.id, r.name)}
                      title="Excluir"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            Nenhum morador encontrado.
          </div>
        )}
      </div>
    </div>
  );
};

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
