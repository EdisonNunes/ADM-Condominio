'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, query, limit, orderBy, onSnapshot, where, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { 
  Bell, 
  CalendarDays, 
  Megaphone, 
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const DashboardView: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { residentData, isEstablished, isSindico, isAdmin } = useAuth();
  const [recentNotices, setRecentNotices] = useState<any[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!isEstablished) return;

    const qMural = query(collection(db, 'mural'), orderBy('createdAt', 'desc'), limit(3));
    const unsubscribeMural = onSnapshot(qMural, (snapshot) => {
      setRecentNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'mural'));

    const today = new Date().toISOString().split('T')[0];
    const qReservations = query(
      collection(db, 'reservations'), 
      where('date', '>=', today),
      orderBy('date', 'asc'),
      limit(5)
    );
    
    const unsubscribeReservations = onSnapshot(qReservations, (snapshot) => {
      setUpcomingReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'reservations'));

    return () => {
      unsubscribeMural();
      unsubscribeReservations();
    };
  }, [isEstablished]);

  const handleConfirmReservation = async (reservationId: string) => {
    setIsUpdating(reservationId);
    try {
      await updateDoc(doc(db, 'reservations', reservationId), {
        status: 'confirmed',
        updatedAt: new Date()
      });
    } catch (err) {
      console.error("Error confirming reservation:", err);
      alert("Erro ao confirmar reserva.");
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-8 p-6 lg:p-10 pt-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Stats/Shortcuts */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Megaphone size={20} className="text-blue-500" /> Mural de Avisos
              </h2>
              <button 
                onClick={() => setActiveTab('mural')}
                className="text-blue-600 font-semibold text-sm flex items-center gap-1 hover:underline"
              >
                Ver todos <ArrowRight size={14} />
              </button>
            </div>
            
            <div className="space-y-4">
              {recentNotices.length > 0 ? (
                recentNotices.map((notice) => (
                  <motion.div 
                    key={notice.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-slate-800">{notice.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-full uppercase tracking-widest">
                        {notice.category || 'Geral'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{notice.content}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                      <Clock size={12} />
                      {notice.createdAt?.toDate ? format(notice.createdAt.toDate(), "dd 'de' MMMM", { locale: ptBR }) : 'Recentemente'}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center p-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-400">Nenhum aviso no momento.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
           <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-blue-500" /> Próximas Reservas
            </h2>
            <div className="space-y-3">
              {upcomingReservations.length > 0 ? (
                upcomingReservations.map((res) => (
                  <div key={res.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-black text-blue-600 uppercase tracking-tighter">
                        {res.areaName}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        res.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        res.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {res.status === 'confirmed' ? 'Confirmado' : res.status === 'pending' ? 'Pendente' : 'Cancelado'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      Apto {res.apartmentId} - {res.userName?.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between font-medium">
                      <div className="flex items-center gap-1">
                        <CalendarDays size={10} /> {res.date} • {res.startTime}
                      </div>

                      {isSindico && res.status === 'pending' && (
                        <button
                          disabled={isUpdating === res.id}
                          onClick={() => handleConfirmReservation(res.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md text-[9px] font-bold transition-all disabled:opacity-50"
                        >
                          {isUpdating === res.id ? '...' : 'Confirmar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">Nenhuma reserva futura.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
