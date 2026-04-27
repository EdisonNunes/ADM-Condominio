'use client'

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/Sidebar';
import { Login } from '@/components/Login';
import { DashboardView } from '@/components/DashboardView';
import { ReservationsView } from '@/components/ReservationsView';
import { MuralView } from '@/components/MuralView';
import { OccurrencesView } from '@/components/OccurrencesView';
import { RulesView } from '@/components/RulesView';
import { ChatView } from '@/components/ChatView';
import { ResidentsView } from '@/components/ResidentsView';
import { ApartmentsView } from '@/components/ApartmentsView';
import { SettingsView } from '@/components/SettingsView';
import { DocumentsView } from '@/components/DocumentsView';
import { Header } from '@/components/Header';
import { motion, AnimatePresence } from 'motion/react';

export default function Home() {
  const { residentData, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!residentData) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView setActiveTab={setActiveTab} />;
      case 'reservations': return <ReservationsView />;
      case 'mural': return <MuralView />;
      case 'occurrences': return <OccurrencesView />;
      case 'rules': return <RulesView />;
      case 'documents': return <DocumentsView />;
      case 'chat': return <ChatView />;
      case 'residents': return <ResidentsView />;
      case 'apartments': return <ApartmentsView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
      />
      
      <main className="flex-1 overflow-y-auto">
        <Header setActiveTab={setActiveTab} />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
