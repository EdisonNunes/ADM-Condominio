'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldCheck, Home, Image as ImageIcon, ChevronRight, X, AlertCircle, Save } from 'lucide-react';
import { ApartmentsView } from './ApartmentsView';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

export const SettingsView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'menu' | 'units' | 'logo'>('menu');
  const [loading, setLoading] = useState(false);
  
  // Condominium Settings State
  const [condoName, setCondoName] = useState('CondoDigital');
  const [condoLogo, setCondoLogo] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'config'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name) setCondoName(data.name);
          if (data.logo) setCondoLogo(data.logo);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      }
    };
    fetchSettings();
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md text-center"
        >
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-slate-500 text-sm mt-2">Esta área é exclusiva para o Administrador Master do sistema.</p>
        </motion.div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        alert("O arquivo é muito grande. O limite recomendado é de 200KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCondoLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), {
        name: condoName,
        logo: condoLogo,
        updatedAt: new Date()
      });
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      alert('Erro ao salvar as configurações.');
    } finally {
      setLoading(false);
    }
  };

  // Authenticated Settings Menu
  return (
    <div className="p-6 lg:p-10 space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={18} className="text-green-500" />
            <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Painel Master Autenticado</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações do Sistema</h1>
          <p className="text-slate-500 mt-1">Gerencie parâmetros fundamentais do condomínio.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <aside className="space-y-2">
          <button
            onClick={() => setActiveSubTab('menu')}
            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${activeSubTab === 'menu' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3">
              <Lock size={18} />
              <span className="font-bold">Início</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setActiveSubTab('units')}
            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${activeSubTab === 'units' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3">
              <Home size={18} />
              <span className="font-bold">Cadastrar Unidades</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setActiveSubTab('logo')}
            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${activeSubTab === 'logo' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3">
              <ImageIcon size={18} />
              <span className="font-bold">Logotipo</span>
            </div>
            <ChevronRight size={16} />
          </button>
        </aside>

        <main className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {activeSubTab === 'menu' && (
              <motion.div 
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-4"
              >
                <ShieldCheck size={48} className="mx-auto text-blue-500" />
                <h2 className="text-2xl font-bold">Acesso Concedido</h2>
                <p className="text-slate-500 max-w-sm mx-auto">Selecione uma opção ao lado para realizar alterações críticas na estrutura do condomínio.</p>
              </motion.div>
            )}

            {activeSubTab === 'units' && (
              <motion.div 
                key="units"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ApartmentsView />
              </motion.div>
            )}

            {activeSubTab === 'logo' && (
              <motion.div 
                key="logo"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white p-8 rounded-3xl border border-slate-200 space-y-8"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Identidade Visual</h3>
                  <p className="text-sm text-slate-500">Personalize a aparência do portal do seu condomínio.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700">Visualização Atual</label>
                    <div className="h-40 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center p-4 overflow-hidden relative group">
                      {condoLogo ? (
                        <img 
                          src={condoLogo} 
                          alt="Logo Preview" 
                          className="max-w-full max-h-full object-contain drop-shadow-sm" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center">
                          <ImageIcon size={32} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-xs text-slate-400 font-medium tracking-tight uppercase">Sem Logotipo</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                      <div className="flex gap-3">
                        <AlertCircle size={18} className="text-amber-500 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Limitações e Recomendações</p>
                          <ul className="text-[11px] text-amber-700 space-y-1 list-disc pl-3 leading-relaxed">
                            <li><strong>Formato:</strong> Use preferencialmente <strong>PNG com transparência</strong>.</li>
                            <li><strong>Proporção:</strong> Logos horizontais (formato retangular) funcionam melhor.</li>
                            <li><strong>Tamanho:</strong> Limite de <strong>200KB</strong> para garantir performance.</li>
                            <li><strong>Resolução:</strong> Recomendado 400x120 pixels.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                       <input 
                         type="file" 
                         id="logo-upload" 
                         className="hidden" 
                         accept="image/png, image/jpeg, image/webp"
                         onChange={handleFileChange}
                       />
                       <label 
                         htmlFor="logo-upload"
                         className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-100 transition-all font-sans"
                       >
                         <ImageIcon size={14} /> Selecionar Imagem
                       </label>
                       {condoLogo && (
                         <button 
                           onClick={() => setCondoLogo(null)}
                           className="px-4 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-all font-sans"
                         >
                           Remover
                         </button>
                       )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700">Configurações</label>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="Nome do Condomínio" 
                        className="w-full px-4 py-3 border rounded-xl"
                        value={condoName}
                        onChange={(e) => setCondoName(e.target.value)}
                      />
                      <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Save size={18} /> {loading ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
