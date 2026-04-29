'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { 
  FileText, 
  Download, 
  Upload, 
  Trash2, 
  Plus, 
  X, 
  File,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const DocumentsView: React.FC = () => {
  const { isSindico, isAdmin } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [form, setForm] = useState({ name: '', url: '', category: 'Regimento Interno', fileName: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const categories = [
    'Todos',
    'Regimento Interno',
    'Atas de Reunião',
    'Balancetes',
    'Comunicados Oficiais',
    'Outros'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Por favor, selecione apenas arquivos PDF.');
        return;
      }
      // Firestore document limit is 1MB. Data URLs are larger than raw binary.
      // 700KB is a safe threshold for the Base64 string to stay under 1MB.
      if (file.size > 700 * 1024) {
        alert('O arquivo é muito grande para armazenamento direto (limite de 700KB). Para arquivos maiores, utilize um link externo.');
        return;
      }

      const reader = new FileReader();
      const fileName = file.name;
      reader.onload = (event) => {
        setForm({ 
          ...form, 
          url: event.target?.result as string,
          fileName: fileName,
          name: form.name || fileName.replace('.pdf', '')
        });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'documents'));
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url) {
      alert("Por favor, selecione um arquivo ou insira uma URL.");
      return;
    }
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'documents'), {
        ...form,
        createdAt: serverTimestamp(),
      });
      alert("Documento adicionado com sucesso!");
      setIsAdding(false);
      setForm({ name: '', url: '', category: 'Regimento Interno', fileName: '' });
    } catch (error) {
      console.error(error);
      alert("Erro ao adicionar documento.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirmation({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await deleteDoc(doc(db, 'documents', deleteConfirmation.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `documents/${deleteConfirmation.id}`);
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const downloadDocument = (url: string, name: string) => {
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For external URLs, we try to download if possible, otherwise open in new tab
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.pdf`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      window.open(url, '_blank');
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Documentos e Regras</h1>
          <p className="text-slate-500 mt-2">Acesse documentos oficiais, atas e o regimento do condomínio.</p>
        </div>
        {(isSindico || isAdmin) && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} /> Upload PDF
          </button>
        )}
      </header>

      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
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
              <h3 className="text-xl font-bold text-slate-900 mb-2">Remover Documento</h3>
              <p className="text-slate-500 text-sm mb-8">
                Tem certeza que deseja remover o documento <strong>{deleteConfirmation.name}</strong>? Esta ação não pode ser desfeita.
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

        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Upload de Documento</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Documento</label>
                  <input 
                    required
                    placeholder="Ex: Regimento Interno 2024" 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Arquivo PDF</label>
                  <div className="space-y-3">
                    <input 
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      ref={fileInputRef}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-all overflow-hidden"
                    >
                      <Upload size={18} className="shrink-0" />
                      <span className="truncate">
                        {form.fileName || (form.url.startsWith('data:') ? 'Arquivo Selecionado' : 'Selecionar arquivo do computador')}
                      </span>
                    </button>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-100"></span>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                        <span className="bg-white px-2 text-slate-300">ou use um link</span>
                      </div>
                    </div>

                    <input 
                      type="url"
                      placeholder="https://exemplo.com/arquivo.pdf" 
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                      value={form.url.startsWith('data:') ? '' : form.url}
                      onChange={(e) => setForm({...form, url: e.target.value, fileName: ''})}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Escolha um arquivo do computador ou insira o link direto.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white"
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value})}
                  >
                    <option>Regimento Interno</option>
                    <option>Atas de Reunião</option>
                    <option>Balancetes</option>
                    <option>Comunicados Oficiais</option>
                    <option>Outros</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {isUploading ? 'Salvando...' : 'Salvar Documento'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocs.length > 0 ? (
          filteredDocs.map((document) => (
            <motion.div
              layout
              key={document.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                  <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{document.category}</span>
                    {(isSindico || isAdmin) && (
                      <button 
                        onClick={() => handleDelete(document.id, document.name)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 truncate mb-1">{document.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <File size={10} /> PDF • {document.createdAt?.toDate ? format(document.createdAt.toDate(), "dd/MM/yyyy") : 'Recentemente'}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => downloadDocument(document.url, document.name)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <Download size={14} /> Download PDF
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
             <FileText size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-medium">Nenhum documento encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};
