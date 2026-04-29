'use client'

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, serverTimestamp, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Users, Search, Phone, Mail, Home, ShieldCheck, ShieldAlert, Plus, X, UserCheck, UserMinus, Lock, AlertCircle, Edit2, Trash2, FileUp, FileDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import Papa from 'papaparse';

type ResidentType = 'Proprietário' | 'Morador' | 'Inquilino';

export const ResidentsView: React.FC = () => {
  const { isAdmin, isSindico } = useAuth();
  const [residents, setResidents] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirmation({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await deleteDoc(doc(db, 'residents', deleteConfirmation.id));
      alert("Morador removido com sucesso.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `residents/${deleteConfirmation.id}`);
    } finally {
      setDeleteConfirmation(null);
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

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "ISO-8859-1",
      complete: async (results) => {
        const data = results.data as any[];
        const batch = writeBatch(db);
        const residentsCol = collection(db, 'residents');
        
        let count = 0;
        let updateCount = 0;
        try {
          for (const row of data) {
            // Mapping common column names
            const name = (row.Nome || row.Name || row.nome || row.name || '').trim();
            const email = (row.Email || row.email || '').trim();
            const apt = String(row.Apartamento || row.Unidade || row.Apto || row.Unit || row.apartment || '').trim();
            const phone = String(row.Telefone || row.Celular || row.Phone || row.phone || '').trim();
            const rawType = (row.Tipo || row.Type || 'Morador').trim();
            
            // Normalize ResidentType with accents
            let type: ResidentType = 'Morador';
            if (rawType.toLowerCase().includes('propriet')) type = 'Proprietário';
            else if (rawType.toLowerCase().includes('inquilino')) type = 'Inquilino';
            else if (rawType.toLowerCase().includes('morador')) type = 'Morador';
            
            // Boolean mapping for columns like Sindico, Nao Residente
            const parseBool = (val: any) => {
              if (!val) return false;
              const s = String(val).toLowerCase().trim();
              return s === 'sim' || s === 's' || s === 'true' || s === '1' || s === 'yes' || s === 'y';
            };

            const sindicoVal = row.Sindico || row.Sindica || row.Síndico || row.isSindico || row.is_sindico;
            const nonResidentVal = row['Não Residente'] || row['Nao Residente'] || row.NonResident || row.isNonResident || row.Fora;

            if (name && apt) {
              // Check if resident already exists (match by Name and Apartment)
              const existingResident = residents.find(r => 
                r.name?.toLowerCase().trim() === name.toLowerCase() && 
                String(r.apartmentId).trim() === apt
              );

              const residentPayload = {
                name,
                email: email || '',
                apartmentId: apt,
                phoneNumber: phone ? formatPhone(phone) : '',
                residentType: type,
                isSindico: parseBool(sindicoVal),
                isNonResident: parseBool(nonResidentVal),
                updatedAt: serverTimestamp()
              };

              if (existingResident) {
                batch.update(doc(db, 'residents', existingResident.id), residentPayload);
                updateCount++;
              } else {
                const newDocRef = doc(residentsCol);
                batch.set(newDocRef, {
                  ...residentPayload,
                  role: 'resident',
                  createdAt: serverTimestamp()
                });
                count++;
              }
            }
          }

          if (count > 0 || updateCount > 0) {
            await batch.commit();
            let msg = '';
            if (count > 0) msg += `${count} novos moradores importados. `;
            if (updateCount > 0) msg += `\n${updateCount} moradores existentes foram atualizados.`;
            alert(msg);
          } else {
            alert("Nenhum dado válido encontrado no arquivo. Certifique-se de que existem as colunas 'Nome' e 'Apartamento'.");
          }
        } catch (err) {
          console.error("Erro na importação:", err);
          alert("Ocorreu um erro ao importar os moradores.");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("Erro no Parse:", error);
        alert("Erro ao ler o arquivo CSV.");
        setIsImporting(false);
      }
    });
  };

  const handleCSVExport = () => {
    if (residents.length === 0) {
      alert("Não há moradores para exportar.");
      return;
    }

    const exportData = residents.map(r => ({
      'Nome': r.name || '',
      'Apartamento': r.apartmentId || '',
      'Email': r.email || '',
      'Telefone': r.phoneNumber || '',
      'Tipo': r.residentType || 'Morador',
      'Sindico': r.isSindico ? 'Sim' : 'Não',
      'Não Residente': r.isNonResident ? 'Sim' : 'Não'
    }));

    const csv = Papa.unparse(exportData, { delimiter: ';' });
    // UTF-8 BOM to ensure Excel opens with correct encoding
    const blob = new Blob(["\ufeff", csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `moradores_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const stats = {
    totalResidentsCount: residents.filter(r => 
      (r.residentType === 'Proprietário' && !r.isNonResident) || 
      r.residentType === 'Morador' || 
      r.residentType === 'Inquilino'
    ).length,
    totalTenantsCount: residents.filter(r => r.residentType === 'Inquilino').length,
    nonResidentOwnersCount: residents.filter(r => r.residentType === 'Proprietário' && r.isNonResident).length
  };

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
    <div className="p-6 lg:p-10 space-y-8">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={24} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Moradores</h1>
          </div>
          <p className="text-slate-500">Gerencie moradores, permissões e importações de dados.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="relative w-full md:w-64">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              placeholder="Buscar por nome ou unidade..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleCSVImport} 
              className="hidden" 
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
              title="Importar lista do Excel (CSV)"
            >
              <FileUp size={18} className={isImporting ? "animate-bounce" : ""} /> 
              Importar
            </button>

            <button
              onClick={handleCSVExport}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all"
              title="Exportar para CSV"
            >
              <FileDown size={18} /> 
              Exportar
            </button>

            <button
              onClick={() => setIsAdding(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all whitespace-nowrap"
            >
              <Plus size={18} /> Novo Morador
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={80} />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total de Moradores</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-slate-900">{stats.totalResidentsCount}</h3>
            <span className="text-xs text-slate-400 font-medium">Cadastrados</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1 italic">
            <AlertCircle size={10} /> Proprietários Residentes, Moradores e Inquilinos
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Home size={80} />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total de Inquilinos</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-blue-600">{stats.totalTenantsCount}</h3>
            <span className="text-xs text-slate-400 font-medium">Inquilinos</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full" 
                style={{ width: `${(stats.totalTenantsCount / (stats.totalResidentsCount || 1)) * 100}%` }} 
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1 italic">
             Perfil Inquilino cadastrado
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ShieldAlert size={80} />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">NÃO RESIDENTES</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-indigo-600">{stats.nonResidentOwnersCount}</h3>
            <span className="text-xs text-slate-400 font-medium">Proprietários</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full" 
                style={{ width: `${(stats.nonResidentOwnersCount / (stats.nonResidentOwnersCount + stats.totalResidentsCount || 1)) * 100}%` }} 
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1 italic">
            Proprietários que não vivem no local
          </p>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setDeleteConfirmation(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center"
            >
              <div className="h-16 w-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Morador</h3>
              <p className="text-slate-500 text-sm mb-8">
                Tem certeza que deseja excluir <strong>{deleteConfirmation.name}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all font-sans"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all font-sans"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
                      <p className="text-xs text-slate-400 flex items-center gap-1.5"><Mail size={12} className="opacity-60" /> {r.email || 'Não cadastrado'}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5"><Phone size={12} className="opacity-60" /> {r.phoneNumber || 'Não cadastrado'}</p>
                      {r.isSindico && (
                        <div className="mt-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[8px] font-black bg-indigo-600 text-white uppercase shadow-sm inline-block leading-normal">
                            Síndico
                          </span>
                        </div>
                      )}
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
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                      {r.residentType}
                    </span>
                    {r.role === 'admin' && (
                      <span className="px-2 py-1 rounded-md text-[9px] font-black bg-slate-900 text-white uppercase text-center min-w-[40px]">
                        Admin
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
                      className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={20} />
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
