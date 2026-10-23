import React, {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
} from 'react';

import { User } from './types/User';
import { Receipt } from './types/Receipt';
import { Announcement } from './types/Announcement';

interface GlobalContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  scannedReceipts: Receipt[];
  setScannedReceipts: React.Dispatch<React.SetStateAction<Receipt[]>>;
  cameraOpen: boolean;
  setCameraOpen: React.Dispatch<React.SetStateAction<boolean>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
}

const NO_ANNOUNCEMENTS: Announcement[] = [];

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

interface GlobalProviderProps {
  children: ReactNode;
}

export const GlobalProvider = ({ children }: GlobalProviderProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannedReceipts, setScannedReceipts] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Obaveštenja se čuvaju uz korisnika za kog su učitana, da obaveštenja
  // prethodnog korisnika (i zakasneli odgovori za njega) ne bi bila vidljiva posle nove prijave
  const uid = user?.uid;
  const [announcementState, setAnnouncementState] = useState<{
    uid?: string;
    list: Announcement[];
  }>({ list: NO_ANNOUNCEMENTS });
  const announcements =
    announcementState.uid === uid ? announcementState.list : NO_ANNOUNCEMENTS;
  const setAnnouncements = useCallback<
    React.Dispatch<React.SetStateAction<Announcement[]>>
  >(
    (action) =>
      setAnnouncementState((previous) => {
        const base =
          previous.uid === uid ? previous.list : NO_ANNOUNCEMENTS;
        return {
          uid,
          list: typeof action === 'function' ? action(base) : action,
        };
      }),
    [uid],
  );

  return (
    <GlobalContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        user,
        setUser,
        loading,
        setLoading,
        scannedReceipts,
        setScannedReceipts,
        cameraOpen,
        setCameraOpen,
        announcements,
        setAnnouncements,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = (): GlobalContextType => {
  const context = useContext(GlobalContext);
  if (!context)
    throw new Error('useGlobalContext must be used within a GlobalProvider');

  return context;
};

export default GlobalProvider;
