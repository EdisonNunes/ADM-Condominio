'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Megaphone, Plus, Trash2, Calendar, User, X, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const MuralView: React.FC = () => {
  const { residentData, isAdmin, isSindico } = useAuth();
  const isManagement = isAdmin || isSindico;
  const [notices, setNotices] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'Geral' });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, title: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'mural'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'mural'));
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentData || !isManagement) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'mural'), {
        ...form,
        authorId: residentData.id,
        authorName: residentData.name || 'Administrador',
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setForm({ title: '', content: '', category: 'Geral' });
    } catch (error) {
      console.error("Error creating notice:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (!isManagement) return;
    setDeleteConfirmation({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await deleteDoc(doc(db, 'mural', deleteConfirmation.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `mural/${deleteConfirmation.id}`);
    } finally {
      setDeleteConfirmation(null);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mural de Avisos</h1>
          <p className="text-slate-500 mt-2">Fique por dentro das novidades do condomínio.</p>
        </div>
        {isManagement && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={20} /> Novo Aviso
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {notices.length > 0 ? (
          notices.map((notice) => (
            <motion.div
              layout
              key={notice.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow relative group"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-full uppercase tracking-widest flex items-center gap-1">
                  <Tag size={10} /> {notice.category}
                </span>
                {isManagement && (
                  <button 
                    onClick={() => handleDelete(notice.id, notice.title)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{notice.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{notice.content}</p>
              
              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar size={14} />
                  {notice.createdAt?.toDate ? format(notice.createdAt.toDate(), "dd/MM/yyyy", { locale: ptBR }) : 'Recentemente'}
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <User size={14} /> {notice.authorName}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <Megaphone size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400">Nenhum aviso publicado ainda.</p>
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
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Aviso</h3>
              <p className="text-slate-500 text-sm mb-8">
                Tem certeza que deseja excluir o aviso <strong>{deleteConfirmation.title}</strong>? Esta ação não pode ser desfeita.
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

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <form onSubmit={handleCreate} className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">Novo Aviso</h3>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700">Título</label>
                    <input
                      required
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({...form, title: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ex: Manutenção da Piscina"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700">Categoria</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({...form, category: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                    >
                      <option>Geral</option>
                      <option>Manutenção</option>
                      <option>Segurança</option>
                      <option>Lazer</option>
                      <option>Financeiro</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700">Conteúdo</label>
                    <textarea
                      required
                      rows={5}
                      value={form.content}
                      onChange={(e) => setForm({...form, content: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Descreva os detalhes do comunicado..."
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-200 shadow-blue-100 transition-all disabled:opacity-50"
                >
                  {loading ? 'Publicando...' : 'Publicar Agora'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
