'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Megaphone, 
  AlertTriangle, 
  MessageSquare, 
  Users, 
  Home,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { residentData, isAdmin, isSindico, logout: authLogout } = useAuth();
  const [branding, setBranding] = useState({ name: 'CondoDigital', logo: null as string | null });
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadReservationsCount, setUnreadReservationsCount] = useState(0);
  const [unreadMuralCount, setUnreadMuralCount] = useState(0);
  const [unreadOccurrencesCount, setUnreadOccurrencesCount] = useState(0);
  const [unreadDocumentsCount, setUnreadDocumentsCount] = useState(0);

  useEffect(() => {
    const unsubscribeBranding = onSnapshot(doc(db, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBranding({
          name: data.name || 'CondoDigital',
          logo: data.logo || null
        });
      }
    }, (err) => {
      console.error("Erro ao carregar branding na sidebar:", err);
    });
    
    return () => unsubscribeBranding();
  }, []);

  useEffect(() => {
    if (!residentData) return;

    let unsubscribeChat: () => void = () => {};
    let unsubscribeRes: () => void = () => {};
    let unsubscribeMural: () => void = () => {};
    let unsubscribeOcc: () => void = () => {};
    let unsubscribeDoc: () => void = () => {};

    try {
      if (isSindico || isAdmin) {
        // Síndico/Admin filters
        const qChat = query(collection(db, 'chats'), where('unreadCountForSindico', '>', 0));
        const qRes = query(collection(db, 'reservations'), where('isNewForSindico', '==', true));
        const qOcc = query(collection(db, 'occurrences'), where('isNewForSindico', '==', true));

        unsubscribeChat = onSnapshot(qChat, (snapshot) => {
          const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().unreadCountForSindico || 0), 0);
          setUnreadCount(total);
        }, (err) => console.error("Sidebar Chat Error:", err));

        unsubscribeRes = onSnapshot(qRes, (snapshot) => {
          setUnreadReservationsCount(snapshot.size);
        }, (err) => console.error("Sidebar Res Error:", err));

        unsubscribeOcc = onSnapshot(qOcc, (snapshot) => {
          setUnreadOccurrencesCount(snapshot.size);
        }, (err) => console.error("Sidebar Occ Error:", err));
      } else {
        // Resident filters
        unsubscribeChat = onSnapshot(doc(db, 'chats', residentData.id), (docSnap) => {
          setUnreadCount(docSnap.data()?.unreadCountForResident || 0);
        }, (err) => console.error("Sidebar Chat Res Error:", err));

        const qRes = query(collection(db, 'reservations'), where('userId', '==', residentData.id), where('isNewForResident', '==', true));
        unsubscribeRes = onSnapshot(qRes, (snapshot) => {
          setUnreadReservationsCount(snapshot.size);
        }, (err) => console.error("Sidebar Res Res Error:", err));

        const qMural = query(collection(db, 'mural'), where('isNewForResident', '==', true));
        unsubscribeMural = onSnapshot(qMural, (snapshot) => {
          setUnreadMuralCount(snapshot.size);
        }, (err) => console.error("Sidebar Mural Error:", err));

        const qOcc = query(collection(db, 'occurrences'), where('userId', '==', residentData.id), where('isNewForResident', '==', true));
        unsubscribeOcc = onSnapshot(qOcc, (snapshot) => {
          setUnreadOccurrencesCount(snapshot.size);
        }, (err) => console.error("Sidebar Occ Res Error:", err));

        const qDoc = query(collection(db, 'documents'), where('isNewForResident', '==', true));
        unsubscribeDoc = onSnapshot(qDoc, (snapshot) => {
          setUnreadDocumentsCount(snapshot.size);
        }, (err) => console.error("Sidebar Doc Error:", err));
      }
    } catch (error) {
      console.error("Setup error in Sidebar useEffect:", error);
    }

    return () => {
      unsubscribeChat();
      unsubscribeRes();
      unsubscribeMural();
      unsubscribeOcc();
      unsubscribeDoc();
    };
  }, [residentData, isSindico, isAdmin]);

  const allItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard, roles: ['admin', 'sindico', 'resident'] },
    { id: 'mural', label: 'Mural', icon: Megaphone, roles: ['admin', 'sindico', 'resident'] },
    { id: 'chat', label: 'Chat', icon: MessageSquare, roles: ['admin', 'sindico', 'resident'] },
    { id: 'reservations', label: 'Reservas', icon: CalendarDays, roles: ['admin', 'sindico', 'resident'] },
    { id: 'documents', label: 'Documentos', icon: FileText, roles: ['admin', 'sindico', 'resident'] },
    { id: 'occurrences', label: 'Ocorrências', icon: AlertTriangle, roles: ['admin', 'sindico', 'resident'] },
    { id: 'residents', label: 'Moradores', icon: Users, roles: ['admin', 'sindico'] },
    { id: 'apartments', label: 'Apartamentos', icon: Home, roles: ['admin', 'sindico'] },
    { id: 'settings', label: 'Configuração', icon: Settings, roles: ['admin'] },
  ];

  const menuItems = allItems.filter(item => {
    if (isAdmin) return true;
    if (isSindico) return item.roles.includes('sindico');
    return item.roles.includes('resident');
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 240 : 80 }}
      className="relative flex flex-col bg-white border-r border-slate-200 h-screen sticky top-0 transition-all duration-300 ease-in-out z-40 shrink-0"
    >
      <div className={cn("p-4 flex flex-col items-center relative", !isOpen && "items-center")}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-1.5 rounded-lg hover:bg-slate-100 transition-colors z-10",
            isOpen ? "absolute right-2 top-2" : "mb-4"
          )}
          title={isOpen ? "Recolher" : "Expandir"}
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>

        {isOpen ? (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center w-full px-2 pt-6 pb-2"
          >
            {branding.logo ? (
              <div className="w-full flex justify-center mb-3">
                <img 
                  src={branding.logo} 
                  alt="Logo" 
                  className="w-full h-auto max-h-24 object-contain" 
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <LayoutDashboard size={36} className="text-blue-600 mb-3" />
            )}
            <h1 className="text-sm font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-center leading-tight uppercase tracking-wider">
              {branding.name}
            </h1>
          </motion.div>
        ) : (
          <div className="flex items-center justify-center h-12 w-full mt-4 p-1">
            {branding.logo ? (
              <img 
                src={branding.logo} 
                alt="Logo" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <LayoutDashboard size={24} className="text-blue-600" />
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar min-h-0">
        {menuItems.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-4 p-3 rounded-xl transition-all group relative",
              activeTab === item.id 
                ? "bg-blue-50 text-blue-600 font-bold" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            <item.icon size={22} className={cn("shrink-0", activeTab === item.id ? "text-blue-600" : "group-hover:text-slate-800")} />
            {isOpen && (
              <span className="truncate">{item.label}</span>
            )}
            {item.id === 'mural' && unreadMuralCount > 0 && (
              <div className={cn(
                "h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white",
                !isOpen ? "absolute top-2 right-2" : "ml-auto"
              )}>
                {unreadMuralCount > 9 ? '9+' : unreadMuralCount}
              </div>
            )}
            {item.id === 'chat' && unreadCount > 0 && (
              <div className={cn(
                "h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white",
                !isOpen ? "absolute top-2 right-2" : "ml-auto"
              )}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
            {item.id === 'reservations' && unreadReservationsCount > 0 && (
              <div className={cn(
                "h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white",
                !isOpen ? "absolute top-2 right-2" : "ml-auto"
              )}>
                {unreadReservationsCount > 9 ? '9+' : unreadReservationsCount}
              </div>
            )}
            {item.id === 'documents' && unreadDocumentsCount > 0 && (
              <div className={cn(
                "h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white",
                !isOpen ? "absolute top-2 right-2" : "ml-auto"
              )}>
                {unreadDocumentsCount > 9 ? '9+' : unreadDocumentsCount}
              </div>
            )}
            {item.id === 'occurrences' && unreadOccurrencesCount > 0 && (
              <div className={cn(
                "h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white",
                !isOpen ? "absolute top-2 right-2" : "ml-auto"
              )}>
                {unreadOccurrencesCount > 9 ? '9+' : unreadOccurrencesCount}
              </div>
            )}
            {!isOpen && activeTab === item.id && (
              <div className="absolute left-0 w-1 h-6 bg-blue-600 rounded-r-full" />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 shrink-0">
        <button
          id="logout-btn"
          onClick={authLogout}
          className="w-full flex items-center gap-4 p-3 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut size={22} className="shrink-0" />
          {isOpen && <span className="font-medium">Sair</span>}
        </button>
      </div>
    </motion.aside>
  );
};
