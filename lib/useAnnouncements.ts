import { useCallback, useState } from 'react';

import { useGlobalContext } from './global-provider';
import { countUnread, withReadState } from './announcements';
import {
  getAnnouncements,
  markAnnouncementRead,
} from './calculusWS/announcementServices';

export const useAnnouncements = () => {
  const { user, announcements, setAnnouncements } = useGlobalContext();
  const [refreshing, setRefreshing] = useState(false);

  const uid = user?.uid ? String(user.uid) : null;
  const token = user?.sessionToken ?? null;

  const refresh = useCallback(async () => {
    if (!uid || !token) {
      setAnnouncements([]);
      return;
    }
    setRefreshing(true);
    try {
      const fresh = await getAnnouncements(uid, token);
      if (fresh) setAnnouncements(fresh);
    } finally {
      setRefreshing(false);
    }
  }, [uid, token, setAnnouncements]);

  // Optimistično ažuriranje, vraća se prethodno stanje ako API odbije izmenu
  const setRead = useCallback(
    async (id: string, read: boolean = true) => {
      if (!uid || !token) return;
      setAnnouncements((current) => withReadState(current, id, read));
      const ok = await markAnnouncementRead(id, uid, token, read);
      if (!ok) setAnnouncements((current) => withReadState(current, id, !read));
    },
    [uid, token, setAnnouncements],
  );

  return {
    announcements,
    unreadCount: countUnread(announcements),
    refreshing,
    refresh,
    setRead,
  };
};
