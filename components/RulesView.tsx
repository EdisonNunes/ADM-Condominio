'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { BookOpen, Shield, VolumeX, Car, Dog, Users, Trash2, Plus, Edit2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES: { [key: string]: any } = {
  'Silêncio': { icon: VolumeX, color: 'text-purple-500', bg: 'bg-purple-50' },
  'Segurança': { icon: Shield, color: 'text-red-500', bg: 'bg-red-50' },
  'Garagem': { icon: Car, color: 'text-blue-500', bg: 'bg-blue-50' },
  'Pets': { icon: Dog, color: 'text-orange-500', bg: 'bg-orange-50' },
  'Piscina': { icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  'Geral': { icon: BookOpen, color: 'text-slate-500', bg: 'bg-slate-50' },
};

export const RulesView: React.FC = () => {
  const { isAdmin, isSindico } = useAuth();
  const isManagement = isAdmin || isSindico;
  const [rules, setRules] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'Geral' });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, title: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rules'), (snapshot) => {
      setRules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'rules'));
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManagement) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'rules', editingId), form);
        alert("Regra atualizada com sucesso!");
      } else {
        await addDoc(collection(db, 'rules'), form);
        alert("Regra adicionada com sucesso!");
      }
      closeForm();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar regra.");
    }
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({ title: '', content: '', category: 'Geral' });
  };

  const startEdit = (rule: any) => {
    setForm({
      title: rule.title,
      content: rule.content,
      category: rule.category
    });
    setEditingId(rule.id);
    setIsAdding(true);
  };

  const handleDelete = (id: string, title: string) => {
    if (!isManagement) return;
    setDeleteConfirmation({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await deleteDoc(doc(db, 'rules', deleteConfirmation.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `rules/${deleteConfirmation.id}`);
    } finally {
      setDeleteConfirmation(null);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Normas e Regras</h1>
          <p className="text-slate-500 mt-2">Manual de convivência e regimento interno.</p>
        </div>
        {isManagement && (
          <button
            onClick={() => setIsAdding(true)}
            className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Plus size={20} />
          </button>
        )}
      </header>

      {isAdding && (
         <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white border-2 border-blue-100 p-6 rounded-3xl space-y-4 shadow-sm"
         >
           <div className="flex items-center justify-between">
             <h3 className="font-bold text-slate-900">{editingId ? 'Editar Regra' : 'Nova Regra'}</h3>
             <button onClick={closeForm}><X size={20} /></button>
           </div>
           <form onSubmit={handleSave} className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <input 
                 required
                 placeholder="Título da regra" 
                 className="px-4 py-3 border rounded-xl"
                 value={form.title}
                 onChange={(e) => setForm({...form, title: e.target.value})}
               />
               <select 
                 className="px-4 py-3 border rounded-xl bg-white"
                 value={form.category}
                 onChange={(e) => setForm({...form, category: e.target.value})}
               >
                 {Object.keys(CATEGORIES).map(cat => <option key={cat}>{cat}</option>)}
               </select>
             </div>
             <textarea 
               required
               placeholder="Conteúdo da regra..." 
               className="w-full px-4 py-3 border rounded-xl min-h-[100px]"
               value={form.content}
               onChange={(e) => setForm({...form, content: e.target.value})}
             />
             <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">
               {editingId ? 'Atualizar Regra' : 'Salvar Regra'}
             </button>
           </form>
         </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rules.length > 0 ? (
          rules.map((rule) => (
            <motion.div
              layout
              key={rule.id}
              className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative group"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0",
                  CATEGORIES[rule.category]?.bg || 'bg-slate-50',
                  CATEGORIES[rule.category]?.color || 'text-slate-500'
                )}>
                  {React.createElement(CATEGORIES[rule.category]?.icon || BookOpen, { size: 28 })}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{rule.category}</span>
                    {isManagement && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => startEdit(rule)} 
                          className="text-slate-300 hover:text-blue-500 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(rule.id, rule.title)} 
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{rule.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{rule.content}</p>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
             <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400">Nenhuma regra cadastrada.</p>
          </div>
        )}
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
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Regra</h3>
              <p className="text-slate-500 text-sm mb-8">
                Tem certeza que deseja excluir a regra <strong>{deleteConfirmation.title}</strong>? Esta ação não pode ser desfeita.
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
      </AnimatePresence>
    </div>
  );
};
