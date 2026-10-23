import axios from 'axios';
import { Announcement } from '../types/Announcement';
import { API_BASE_URL } from './apiConfig';

const API_ANNOUNCEMENTS_URL = `${API_BASE_URL}/announcements`;

// Obaveštenja nisu ključna za rad aplikacije, pa greške ne prikazuju alert,
// već se vraća null i zadržava poslednje učitano stanje

export const getAnnouncements = async (
  korisniksk: string,
  sessionToken: string,
): Promise<Announcement[] | null> => {
  try {
    const res = await axios.get(`${API_ANNOUNCEMENTS_URL}/${korisniksk}`, {
      headers: { 'x-session-token': sessionToken },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (res.status === 200 && Array.isArray(res.data?.announcements)) {
      return res.data.announcements;
    }
    return null;
  } catch {
    return null;
  }
};

export const markAnnouncementRead = async (
  id: string,
  korisniksk: string,
  sessionToken: string,
  read: boolean = true,
): Promise<boolean> => {
  try {
    const res = await axios.put(
      `${API_ANNOUNCEMENTS_URL}/${id}/read`,
      { userId: korisniksk, token: sessionToken, read },
      { timeout: 15000, validateStatus: () => true },
    );

    return res.status === 200;
  } catch {
    return false;
  }
};
