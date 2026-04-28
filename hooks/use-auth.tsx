'use client'

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { signInAnonymously } from 'firebase/auth';
import { query, collection, where, getDocs, getDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';

interface ResidentData {
  id: string;
  name: string;
  apartmentId: string;
  role: 'resident' | 'admin';
  phoneNumber?: string;
  isSindico?: boolean;
}

interface FirebaseContextType {
  residentData: ResidentData | null;
  loading: boolean;
  isEstablished: boolean;
  isAdmin: boolean;
  isSindico: boolean;
  login: (apartmentId: string, password: string) => Promise<{ success: boolean; isFirstLogin?: boolean }>;
  setInitialPassword: (apartmentId: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<FirebaseContextType>({
  residentData: null,
  loading: true,
  isEstablished: false,
  isAdmin: false,
  isSindico: false,
  login: async () => ({ success: false }),
  setInitialPassword: async () => false,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [residentData, setResidentData] = useState<ResidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEstablished, setIsEstablished] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsEstablished(false);
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Anonymous sign in failed", err);
        }
      } else {
        // If we have a resident session but no auth link for this UID, establish it
        const savedSession = localStorage.getItem('condo_session');
        if (savedSession) {
          try {
            const data = JSON.parse(savedSession);
            const uid = user.uid;
            
            // Re-sync auth_links to ensure security rules work
            await setDoc(doc(db, 'auth_links', uid), { 
              apartmentId: data.apartmentId, 
              role: data.role || 'resident',
              isSindico: data.isSindico || false,
              updatedAt: new Date()
            }, { merge: true });
            setIsEstablished(true);
          } catch (e) {
            console.error("Failed to re-sync auth_links", e);
            setIsEstablished(true); // Still set to true so we don't block forever, though it might fail later
          }
        } else {
          setIsEstablished(true);
        }
      }
    });

    // Check for existing session
    const savedSession = localStorage.getItem('condo_session');
    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResidentData(data);
      } catch (e) {
        console.error("Session error", e);
      }
    }
    setLoading(false);
    return () => unsubscribeAuth();
  }, []);

  const login = async (apartmentId: string, password: string) => {
    try {
      const id = apartmentId.toLowerCase();
      
      // Special Admin check
      if (id === 'admin' && password === 'adm9104') {
        try {
          const credential = await signInAnonymously(auth);
          const uid = credential.user.uid;
          
          await setDoc(doc(db, 'auth_links', uid), { 
            apartmentId: 'ADMIN', 
            role: 'admin',
            isSindico: true,
            updatedAt: new Date()
          });
        } catch (authErr: any) {
          if (authErr.code === 'auth/admin-restricted-operation') {
            console.error("ERRO CRÍTICO: O Login Anônimo não está ativado no Console do Firebase.");
          }
        }
        
        const adminSession: ResidentData = {
          id: 'admin',
          name: 'Administrador',
          apartmentId: 'ADMIN',
          role: 'admin',
          isSindico: true
        };
        
        setResidentData(adminSession);
        localStorage.setItem('condo_session', JSON.stringify(adminSession));
        return { success: true };
      }

      // regular resident check
      const passwordDoc = await getDoc(doc(db, 'unit_passwords', apartmentId));
      
      const data = passwordDoc.exists() ? passwordDoc.data() : null;
      const storedPassword = data?.password;

      // If no password is set for this unit (doc doesn't exist OR password field is missing/empty/whitespace)
      if (!passwordDoc.exists() || !storedPassword || (typeof storedPassword === 'string' && storedPassword.trim() === '')) {
        return { success: false, isFirstLogin: true };
      }

      if (storedPassword === password) {
        const q = query(collection(db, 'residents'), where('apartmentId', '==', apartmentId));
        const querySnapshot = await getDocs(q);
        
        const resident = !querySnapshot.empty 
          ? (querySnapshot.docs.map(d => d.data()) as any).find((r: any) => r.isSindico) || querySnapshot.docs[0].data()
          : { name: `Morador ${apartmentId}`, apartmentId, role: 'resident', isSindico: false };

        try {
          const credential = await signInAnonymously(auth);
          const uid = credential.user.uid;
          
          await setDoc(doc(db, 'auth_links', uid), { 
            apartmentId, 
            role: (resident as any).role || 'resident',
            isSindico: (resident as any).isSindico || false,
            updatedAt: new Date()
          });
        } catch (authErr: any) {
          if (authErr.code === 'auth/admin-restricted-operation') {
            console.error("ERRO CRÍTICO: O Login Anônimo não está ativado no Console do Firebase. Por favor, ative-o em Authentication > Sign-in method.");
          } else {
            console.error("Erro interno de autenticação:", authErr);
          }
        }
        
        const session: ResidentData = {
          id: apartmentId, 
          name: (resident as any).name,
          apartmentId: apartmentId,
          role: (resident as any).role || 'resident',
          isSindico: (resident as any).isSindico || false,
          phoneNumber: (resident as any).phoneNumber
        };
        
        setResidentData(session);
        localStorage.setItem('condo_session', JSON.stringify(session));
        return { success: true };
      }
      
      return { success: false };
    } catch (e) {
      console.error("Login failed with error:", e);
      return { success: false };
    }
  };

  const setInitialPassword = async (apartmentId: string, password: string) => {
    try {
      await setDoc(doc(db, 'unit_passwords', apartmentId), {
        password: password,
        updatedAt: new Date()
      });
      return true;
    } catch (e) {
      console.error("Failed to set password:", e);
      return false;
    }
  };

  const logout = () => {
    setResidentData(null);
    localStorage.removeItem('condo_session');
    auth.signOut();
  };

  const value = {
    residentData,
    loading,
    isEstablished,
    isAdmin: residentData?.role === 'admin',
    isSindico: residentData?.role === 'admin' || residentData?.isSindico === true,
    login,
    setInitialPassword,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
