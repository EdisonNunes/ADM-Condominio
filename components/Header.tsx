'use client'

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const Header: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { residentData, isEstablished, isSindico, isAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadReservationsCount, setUnreadReservationsCount] = useState(0);
  const [unreadMuralCount, setUnreadMuralCount] = useState(0);
  const [unreadOccurrencesCount, setUnreadOccurrencesCount] = useState(0);
  const [unreadDocumentsCount, setUnreadDocumentsCount] = useState(0);

  useEffect(() => {
    if (!residentData || !isEstablished) return;

    let unsubscribeChat: () => void = () => {};
    let unsubscribeRes: () => void = () => {};
    let unsubscribeMural: () => void = () => {};
    let unsubscribeOcc: () => void = () => {};
    let unsubscribeDoc: () => void = () => {};

    try {
      if (isSindico || isAdmin) {
        // Chat notifications for Sindico
        const qChat = query(collection(db, 'chats'), where('unreadCountForSindico', '>', 0));
        unsubscribeChat = onSnapshot(qChat, (snapshot) => {
          const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().unreadCountForSindico || 0), 0);
          setUnreadCount(total);
        }, (err) => console.error("Header Chat Error:", err));

        // Reservation notifications for Sindico
        const qRes = query(collection(db, 'reservations'), where('isNewForSindico', '==', true));
        unsubscribeRes = onSnapshot(qRes, (snapshot) => {
          setUnreadReservationsCount(snapshot.size);
        }, (err) => console.error("Header Res Error:", err));

        // Occurrences for Sindico
        const qOcc = query(collection(db, 'occurrences'), where('isNewForSindico', '==', true));
        unsubscribeOcc = onSnapshot(qOcc, (snapshot) => {
          setUnreadOccurrencesCount(snapshot.size);
        }, (err) => console.error("Header Occ Error:", err));
      } else {
        // Resident notifications
        unsubscribeChat = onSnapshot(doc(db, 'chats', residentData.id), (docSnap) => {
          setUnreadCount(docSnap.data()?.unreadCountForResident || 0);
        }, (err) => console.error("Header Chat Res Error:", err));

        const qRes = query(collection(db, 'reservations'), where('userId', '==', residentData.id), where('isNewForResident', '==', true));
        unsubscribeRes = onSnapshot(qRes, (snapshot) => {
          setUnreadReservationsCount(snapshot.size);
        }, (err) => console.error("Header Res Res Error:", err));

        const qMural = query(collection(db, 'mural'), where('isNewForResident', '==', true));
        unsubscribeMural = onSnapshot(qMural, (snapshot) => {
          setUnreadMuralCount(snapshot.size);
        }, (err) => console.error("Header Mural Error:", err));

        const qOcc = query(collection(db, 'occurrences'), where('userId', '==', residentData.id), where('isNewForResident', '==', true));
        unsubscribeOcc = onSnapshot(qOcc, (snapshot) => {
          setUnreadOccurrencesCount(snapshot.size);
        }, (err) => console.error("Header Occ Res Error:", err));

        const qDoc = query(collection(db, 'documents'), where('isNewForResident', '==', true));
        unsubscribeDoc = onSnapshot(qDoc, (snapshot) => {
          setUnreadDocumentsCount(snapshot.size);
        }, (err) => console.error("Header Doc Error:", err));
      }
    } catch (error) {
      console.error("Setup error in Header useEffect:", error);
    }

    return () => {
      unsubscribeChat();
      unsubscribeRes();
      unsubscribeMural();
      unsubscribeOcc();
      unsubscribeDoc();
    };
  }, [residentData, isSindico, isAdmin, isEstablished]);

  const totalUnread = unreadCount + unreadReservationsCount + unreadMuralCount + unreadOccurrencesCount + unreadDocumentsCount;

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 lg:p-10 pb-0">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Olá, {residentData?.name ? residentData.name.split(' ')[0] : 'Morador'} 👋</h1>
        <p className="text-slate-500 mt-1">Bem-vindo ao portal do seu condomínio.</p>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setActiveTab('chat')}
          className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm relative hover:bg-slate-50 transition-colors"
        >
          <Bell size={24} />
          {totalUnread > 0 && (
            <div className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
              {totalUnread > 9 ? '9+' : totalUnread}
            </div>
          )}
        </button>
        <div className="bg-white px-6 py-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-w-[120px]">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Apartamento</p>
          <p className="text-xl font-bold text-slate-800 leading-none">{residentData?.apartmentId}</p>
        </div>
      </div>
    </header>
  );
};
