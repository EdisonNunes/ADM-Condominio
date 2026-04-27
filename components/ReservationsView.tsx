'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Calendar, Clock, MapPin, X, CheckCircle2, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AREAS = [
  { id: 'salao-festas', name: 'Salão de Festas', capacity: 50, description: 'Perfeito para aniversários e reuniões familiares.' },
  { id: 'churrasqueira', name: 'Churrasqueira', capacity: 15, description: 'Espaço gourmet com vista para o jardim.' },
];

export const ReservationsView: React.FC = () => {
  const { residentData, isEstablished, isSindico } = useAuth();
  const [activeArea, setActiveArea] = useState<any>(null);
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [bookingDate, setBookingDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!residentData || !isEstablished) return;
    const q = isSindico 
      ? query(collection(db, 'reservations'), orderBy('date', 'desc'))
      : query(collection(db, 'reservations'), where('userId', '==', residentData.id), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'reservations'));
    return () => unsubscribe();
  }, [residentData, isEstablished, isSindico]);

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

  const handleBook = async () => {
    if (!residentData || !activeArea || !bookingDate) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'reservations'), {
        areaId: activeArea.id,
        areaName: activeArea.name,
        userId: residentData.id,
        userName: residentData.name,
        apartmentId: residentData.apartmentId,
        date: bookingDate,
        startTime: '09:00', // Hardcoded for simplified example
        endTime: '22:00',
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setActiveArea(null);
      setBookingDate('');
      alert("Reserva solicitada com sucesso!");
    } catch (error) {
      console.error("Error booking:", error);
      alert("Erro ao realizar reserva.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 leading-tight">Áreas Comuns</h1>
        <p className="text-slate-500 mt-2">Escolha um espaço e faça sua reserva com antecedência.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {AREAS.map((area) => (
          <motion.div
            key={area.id}
            whileHover={{ y: -4 }}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col"
          >
            <div className="h-40 bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white">
              <MapPin size={48} className="opacity-40" />
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-xl font-bold text-slate-900">{area.name}</h3>
              <p className="text-sm text-slate-500 mt-2 flex-1">{area.description}</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Capacidade: {area.capacity} pessoas
              </div>
              <button
                onClick={() => setActiveArea(area)}
                className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Reservar
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {isSindico ? 'Todas as Reservas' : 'Minhas Reservas'}
        </h2>
        <div className="space-y-4">
          {myReservations.length > 0 ? (
            myReservations.map((res) => (
              <div key={res.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{res.areaName}</h4>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Calendar size={14} /> {res.date} • <Clock size={14} /> {res.startTime} - {res.endTime}
                    </p>
                    {isSindico && (
                      <p className="text-xs font-bold text-blue-600 mt-1">
                        Apto {res.apartmentId} - {res.userName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase",
                    res.status === 'confirmed' ? "bg-green-100 text-green-700" :
                    res.status === 'pending' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                  )}>
                    {res.status === 'confirmed' ? 'Confirmado' : res.status === 'pending' ? 'Pendente' : 'Cancelado'}
                  </span>

                  {isSindico && res.status === 'pending' && (
                    <button
                      disabled={isUpdating === res.id}
                      onClick={() => handleConfirmReservation(res.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isUpdating === res.id ? '...' : 'Confirmar'}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400">Nenhuma reserva encontrada.</p>
            </div>
          )}
        </div>
      </section>

      {/* Booking Modal */}
      <AnimatePresence>
        {activeArea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveArea(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">Reservar {activeArea.name}</h3>
                  <button onClick={() => setActiveArea(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-500" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Data da Reserva</label>
                    <input 
                      type="date" 
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl">
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                      Lembre-se: Reservas estão sujeitas à aprovação da administração e devem respeitar as normas de uso do espaço.
                    </p>
                  </div>

                  <button
                    disabled={loading || !bookingDate}
                    onClick={handleBook}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-200 shadow-blue-100 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Confirmando...' : 'Solicitar Reserva'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
