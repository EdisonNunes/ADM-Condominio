'use client'

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, limit, setDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Send, User, MessageSquare, Search, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';

export const ChatView: React.FC = () => {
  const { residentData, isAdmin, isSindico, isEstablished } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // If resident, current chat is with residentData.id
  // If admin/sindico, current chat is with selectedUser.id
  const isManagement = isAdmin || isSindico;
  const chatTargetId = isManagement ? selectedUser?.id : residentData?.id;

  useEffect(() => {
    if (!isEstablished) return;

    if (isManagement) {
      // Get all chats summaries ordered by last message
      const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChatUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => handleFirestoreError(err, OperationType.GET, 'chats'));
      return () => unsubscribe();
    }
  }, [isManagement, isEstablished]);

  useEffect(() => {
    if (!chatTargetId || !isEstablished) return;

    // Reset unread count when opening the chat
    if (isManagement && chatTargetId && chatTargetId === selectedUser?.id) {
       setDoc(doc(db, 'chats', chatTargetId), {
         unreadCountForSindico: 0
       }, { merge: true }).catch(console.error);
    } else if (!isManagement && residentData?.id) {
       setDoc(doc(db, 'chats', residentData.id), {
         unreadCountForResident: 0
       }, { merge: true }).catch(console.error);
    }

    const q = query(
      collection(db, `chats/${chatTargetId}/messages`),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, `chats/${chatTargetId}/messages`));

    return () => unsubscribe();
  }, [chatTargetId, isEstablished, isManagement, selectedUser?.id, residentData]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatTargetId || !residentData) return;

    const tempMsg = input;
    setInput('');

    try {
      // Add message to subcollection
      await addDoc(collection(db, `chats/${chatTargetId}/messages`), {
        senderId: residentData.id,
        senderName: residentData.name || 'User',
        content: tempMsg,
        createdAt: serverTimestamp(),
        isAdmin: isManagement,
      });

      // Update summary
      const summaryRef = doc(db, 'chats', chatTargetId);
      const updateData: any = {
        lastMessage: tempMsg,
        lastMessageAt: serverTimestamp(),
        residentName: isManagement ? (selectedUser?.residentName || selectedUser?.name) : residentData.name,
        apartmentId: isManagement ? (selectedUser?.apartmentId) : residentData.apartmentId,
      };

      if (isManagement) {
        updateData.unreadCountForResident = increment(1);
      } else {
        updateData.unreadCountForSindico = increment(1);
      }

      await setDoc(summaryRef, updateData, { merge: true });

    } catch (error) {
      console.error(error);
      setInput(tempMsg);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="p-6 border-b bg-white flex items-center gap-4">
        {isManagement && selectedUser && (
           <button onClick={() => setSelectedUser(null)} className="lg:hidden p-2 hover:bg-slate-100 rounded-full">
             <ChevronLeft />
           </button>
        )}
        <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <MessageSquare size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isManagement && selectedUser ? `Conversa com ${selectedUser.residentName || selectedUser.name}` : 'Chat com a Administração'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">Resposta em até 24h úteis</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* User Selection Sidebar for Admin/Sindico */}
        {isManagement && (
           <div className={cn(
             "w-full lg:w-80 border-r bg-white flex flex-col",
             selectedUser ? "hidden lg:flex" : "flex"
           )}>
             <div className="p-4">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input placeholder="Buscar conversa..." className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl text-sm outline-none border-transparent border-2 focus:border-blue-500 transition-all" />
                </div>
             </div>
             <div className="flex-1 overflow-y-auto">
               {chatUsers.map(u => (
                 <button 
                   key={u.id}
                   onClick={() => setSelectedUser(u)}
                   className={cn(
                     "w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50",
                     selectedUser?.id === u.id ? "bg-blue-50" : ""
                   )}
                 >
                   <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 uppercase font-bold">
                      {(u.residentName || u.name || '?')[0]}
                    </div>
                    {u.unreadCountForSindico > 0 && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-blue-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold">
                        {u.unreadCountForSindico}
                      </div>
                    )}
                   </div>
                   <div className="text-left overflow-hidden flex-1">
                     <div className="flex justify-between items-start">
                       <p className="font-bold text-sm text-slate-800 truncate">{u.residentName || u.name}</p>
                       {u.lastMessageAt && (
                         <span className="text-[10px] text-slate-400 shrink-0">
                           {u.lastMessageAt?.toDate ? format(u.lastMessageAt.toDate(), "HH:mm") : ''}
                         </span>
                       )}
                     </div>
                     <p className="text-xs text-slate-500 truncate mt-0.5">{u.lastMessage || `Apto ${u.apartmentId}`}</p>
                   </div>
                 </button>
               ))}
             </div>
           </div>
        )}

        {/* Message Area */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden",
          isManagement && !selectedUser ? "hidden lg:flex" : "flex"
        )}>
          {!chatTargetId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
              <MessageSquare size={64} className="opacity-20" />
              <p className="font-medium">Selecione um morador para iniciar o chat</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((m, idx) => {
                  const isMe = m.senderId === residentData?.id;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, scale: 0.9, x: isMe ? 20 : -20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed",
                        isMe 
                          ? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100" 
                          : "bg-white text-slate-800 rounded-tl-none border border-slate-200"
                      )}>
                        {m.content}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                         {!isMe && <span className="font-bold text-slate-500">{m.senderName} •</span>}
                         {m.createdAt?.toDate ? format(m.createdAt.toDate(), "HH:mm") : ''}
                      </span>
                    </motion.div>
                  )
                })}
                <div ref={scrollRef} />
              </div>

              <form onSubmit={sendMessage} className="p-6 bg-white border-t flex items-center gap-4">
                <input
                  required
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escreva sua mensagem..."
                  className="flex-1 px-6 py-3 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!input.trim()}
                  className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  <Send size={24} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
