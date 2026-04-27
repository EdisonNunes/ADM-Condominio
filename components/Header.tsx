'use client'

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const Header: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { residentData, isEstablished, isSindico, isAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!residentData || !isEstablished) return;

    if (isSindico || isAdmin) {
      const q = query(collection(db, 'chats'), where('unreadCountForSindico', '>', 0));
      const unsubscribeChat = onSnapshot(q, (snapshot) => {
        const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().unreadCountForSindico || 0), 0);
        setUnreadCount(total);
      });
      return () => unsubscribeChat();
    } else {
      const unsubscribeChat = onSnapshot(doc(db, 'chats', residentData.id), (docSnap) => {
        if (docSnap.exists()) {
          setUnreadCount(docSnap.data().unreadCountForResident || 0);
        } else {
          setUnreadCount(0);
        }
      });
      return () => unsubscribeChat();
    }
  }, [residentData, isSindico, isAdmin, isEstablished]);

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 lg:p-10 pb-0">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Olá, {residentData?.name?.split(' ')[0]} 👋</h1>
        <p className="text-slate-500 mt-1">Bem-vindo ao portal do seu condomínio.</p>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setActiveTab('chat')}
          className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm relative hover:bg-slate-50 transition-colors"
        >
          <Bell size={24} />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
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
