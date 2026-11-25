import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export interface AuthUser {
  id: number;
  name: string;
  email?: string;
  cpf?: string;
  phone?: string;
  address?: string;
  role: 'admin' | 'client';
  avatarUrl?: string;
}

interface AuthContextData {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUserState] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const [token, storedUser] = await AsyncStorage.multiGet([
          'codewear_token',
          'codewear_user',
        ]);
        if (!active) return;
        if (!token[1]) return;

        setIsAuthenticated(true);
        if (storedUser[1]) {
          try {
            setUserState(JSON.parse(storedUser[1]) as AuthUser);
          } catch (error) {
            console.warn('O perfil salvo não pôde ser recuperado:', error);
          }
        }

        try {
          const { data } = await api.get<AuthUser>('users/profile');
          if (!active) return;
          setUserState(data);
          await AsyncStorage.setItem('codewear_user', JSON.stringify(data));
        } catch (error) {
          const requestError = error as { response?: { status?: number } };
          if (requestError.response?.status === 401) {
            await AsyncStorage.multiRemove(['codewear_token', 'codewear_user']);
            if (active) {
              setUserState(null);
              setIsAuthenticated(false);
            }
            return;
          }
          console.warn('Não foi possível atualizar o perfil autenticado:', error);
        }
      } catch (error) {
        console.warn('Não foi possível restaurar a sessão autenticada:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void restoreSession();
    return () => { active = false; };
  }, []);

  const signIn = async (token: string, authenticatedUser: AuthUser) => {
    await AsyncStorage.multiSet([
      ['codewear_token', token],
      ['codewear_user', JSON.stringify(authenticatedUser)],
    ]);
    setUserState(authenticatedUser);
    setIsAuthenticated(true);
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(['codewear_token', 'codewear_user']);
    setUserState(null);
    setIsAuthenticated(false);
  };

  const setUser = useCallback((authenticatedUser: AuthUser | null) => {
    setUserState(authenticatedUser);
    const persist = authenticatedUser
      ? AsyncStorage.setItem('codewear_user', JSON.stringify(authenticatedUser))
      : AsyncStorage.removeItem('codewear_user');
    void persist.catch((error) => {
      console.warn('Não foi possível salvar o perfil autenticado:', error);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, signIn, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}