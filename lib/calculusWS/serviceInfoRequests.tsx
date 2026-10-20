import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

const API_INFO_URL = `${API_BASE_URL}/info`;

export const getDateTimeWebServer = async (): Promise<boolean> => {
  try {
    const res = await axios.get(`${API_INFO_URL}/ws`, { timeout: 15000 });

    if (res.status !== 200) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

export const getDateTimeDBServer = async (): Promise<boolean> => {
  try {
    const res = await axios.get(`${API_INFO_URL}/db`, { timeout: 15000 });

    if (res.status !== 200) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};
