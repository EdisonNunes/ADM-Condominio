'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { AlertCircle, Plus, Clock, CheckCircle2, MessageSquare, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export const OccurrencesView: React.FC = () => {
  const { residentData, isAdmin, isSindico, isEstablished } = useAuth();
  const isManagement = isAdmin || isSindico;
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [adminResponse, setAdminResponse] = useState('');
  const [selectedOccurrence, setSelectedOccurrence] = useState<any>(null);

  useEffect(() => {
    if (!residentData || !isEstablished) return;
    const q = isManagement 
      ? query(collection(db, 'occurrences'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'occurrences'), where('userId', '==', residentData.id), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOccurrences(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'occurrences'));
    return () => unsubscribe();
  }, [residentData, isManagement, isEstablished]);

  useEffect(() => {
    if (!residentData || !isEstablished || occurrences.length === 0) return;

    const clearNotifications = async () => {
      const batch = writeBatch(db);
      let hasChanges = false;

      if (isManagement) {
        const unread = occurrences.filter(o => o.isNewForSindico);
        if (unread.length > 0) {
          unread.forEach(o => {
            batch.update(doc(db, 'occurrences', o.id), { isNewForSindico: false });
          });
          hasChanges = true;
        }
      } else {
        const unread = occurrences.filter(o => o.isNewForResident);
        if (unread.length > 0) {
          unread.forEach(o => {
            batch.update(doc(db, 'occurrences', o.id), { isNewForResident: false });
          });
          hasChanges = true;
        }
      }

      if (hasChanges) {
        try {
          await batch.commit();
        } catch (err) {
          console.error("Erro ao limpar notificações de ocorrências:", err);
        }
      }
    };

    const timeout = setTimeout(clearNotifications, 2000);
    return () => clearTimeout(timeout);
  }, [residentData, isEstablished, isManagement, occurrences]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentData) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'occurrences'), {
        title: form.title,
        description: form.description,
        userId: residentData.id,
        userName: residentData.name,
        apartmentId: residentData.apartmentId,
        status: 'reported',
        createdAt: serverTimestamp(),
        isNewForSindico: true,
        isNewForResident: false,
      });
      setIsModalOpen(false);
      setForm({ title: '', description: '' });
    } catch (error) {
      console.error("Error creating occurrence:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (id: string) => {
    if (!isManagement || !adminResponse) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'occurrences', id), {
        response: adminResponse,
        status: 'resolved',
        isNewForResident: true,
        isNewForSindico: false,
      });
      setSelectedOccurrence(null);
      setAdminResponse('');
    } catch (error) {
      console.error("Error updating occurrence:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ocorrências</h1>
          <p className="text-slate-500 mt-2">Reporte incidentes e acompanhe o status da resolução.</p>
        </div>
        {!isManagement && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-orange-100"
          >
            <Plus size={20} /> Nova Ocorrência
          </button>
        )}
      </header>

      <div className="space-y-4">
        {occurrences.length > 0 ? (
          occurrences.map((occ) => (
            <motion.div
              layout
              key={occ.id}
              onClick={() => isManagement && occ.status !== 'resolved' && setSelectedOccurrence(occ)}
              className={cn(
                "bg-white rounded-2xl border p-6 shadow-sm transition-all",
                isManagement && occ.status !== 'resolved' ? "cursor-pointer hover:border-blue-300" : "border-slate-100"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      occ.status === 'resolved' ? "bg-green-100 text-green-700" : 
                      occ.status === 'in_progress' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {occ.status === 'resolved' ? 'Resolvido' : occ.status === 'in_progress' ? 'Em Andamento' : 'Relatado'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">#{occ.id.slice(0, 6)}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{occ.title}</h3>
                  <p className="text-slate-600 text-sm">{occ.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400 mb-1">
                    {occ.createdAt?.toDate ? format(occ.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Recentemente'}
                  </div>
                  <div className="text-sm font-bold text-slate-800">Apto {occ.apartmentId}</div>
                  <div className="text-xs text-slate-500">{occ.userName}</div>
                </div>
              </div>

              {occ.response && (
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <MessageSquare size={14} /> Resposta Administração
                  </div>
                  <p className="text-sm text-slate-700">{occ.response}</p>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <AlertCircle size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 text-lg">Nenhuma ocorrência registrada.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
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
                  <h3 className="text-2xl font-bold text-slate-900">Relatar Ocorrência</h3>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700">O que aconteceu?</label>
                    <input
                      required
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({...form, title: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Ex: Barulho após horário"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700">Detalhes</label>
                    <textarea
                      required
                      rows={5}
                      value={form.description}
                      onChange={(e) => setForm({...form, description: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                      placeholder="Forneça o máximo de detalhes possível para ajudar na resolução..."
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl shadow-lg shadow-orange-100 transition-all disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar Relato'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Response Modal */}
      <AnimatePresence>
        {selectedOccurrence && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOccurrence(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">Responder Ocorrência</h3>
                  <button onClick={() => setSelectedOccurrence(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-500" />
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Relato Original</p>
                  <p className="text-sm font-bold text-slate-900">{selectedOccurrence.title}</p>
                  <p className="text-sm text-slate-600">{selectedOccurrence.description}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700">Sua Resposta</label>
                  <textarea
                    required
                    rows={4}
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Informe qual medida foi tomada..."
                  />
                </div>

                <button
                  disabled={loading || !adminResponse}
                  onClick={() => handleResponse(selectedOccurrence.id)}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Marcar como Resolvido'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};