import axios from 'axios';
import { User } from '../types/User';
import { customAlert } from '../helpers';
import { removeLocalStorage } from '../localAsyncStorage';
import { API_BASE_URL } from './apiConfig';

const API_AUTH_URL = `${API_BASE_URL}/auth`;
const API_USERS_URL = `${API_BASE_URL}/users`;

// # REGISTER USER
export const register = async (
  email: string,
  password: string,
  pib: string,
  companyName: string,
  contact: string,
): Promise<string | null> => {
  try {
    const res = await axios.post(
      `${API_AUTH_URL}/register`,
      {
        email,
        password,
        companyId: pib,
        companyName,
        contact,
      },
      {
        validateStatus: () => true,
      },
    );

    if (res.status === 201) {
      return 'success';
    } else if (res.status === 400) {
      customAlert('Upozorenje', res.data);
      return null;
    } else {
      throw new Error('Greška prilikom registracije');
    }
  } catch (error) {
    customAlert('Greška', 'Greška prilikom registracije');
    return null;
  }
};

export const login = async (
  email: string,
  password: string,
): Promise<User | null> => {
  try {
    const res = await axios.post(
      `${API_AUTH_URL}/login`,
      { email, password },
      {
        validateStatus: () => true,
      },
    );

    let uid: string = '';

    if (res.status === 200) {
      uid = res.data.user;
    } else if (res.status === 400) {
      customAlert('Upozorenje', res.data);
      return null;
    } else {
      throw new Error('Greška prilikom prijavljivanja korisnika');
    }

    return getUserById(uid, email);
  } catch (error) {
    customAlert('Greška', 'Greška prilikom prijavljivanja korisnika!');
    return null;
  }
};

export const logout = async (
  korisniksk: string,
  sessionToken: string,
): Promise<string | null> => {
  try {
    const res = await axios.post(
      `${API_AUTH_URL}/logout`,
      {
        uid: korisniksk,
        token: sessionToken,
      },
      {
        validateStatus: () => true,
      },
    );

    if (res.status === 200) {
      return 'success';
    } else {
      throw new Error('Greška prilikom odjavljivanja korisnika');
    }
  } catch (error) {
    await removeLocalStorage();
    return null;
  }
};

export const validateSession = async (
  korisniksk: string,
  sessionToken: string,
): Promise<boolean> => {
  try {
    if (!korisniksk || !sessionToken) return false;

    const res = await axios.post(
      `${API_AUTH_URL}/validate`,
      { uid: korisniksk, token: sessionToken },
      { validateStatus: () => true },
    );

    if (res.status === 200 && res.data?.valid === true) return true;

    if (res.status === 401 || res.status === 400) return false;

    return false;
  } catch (e) {
    return false;
  }
};

export const getUserById = async (
  id: string,
  email: string = '',
): Promise<User | null> => {
  try {
    const res = await axios.get(`${API_USERS_URL}/${id}`, {
      validateStatus: () => true,
    });

    if (res.status === 200) {
      const user: User = {
        uid: res.data.user.QRScanKorisnikSK,
        email,
        sessionToken: res?.data?.user?.SessionToken || null,
        companyName: res.data.user.nazivfirme,
        contact: res.data.user?.Kontakt || '',
        databases: res?.data?.user?.SerijskiBrojevi
          ? res.data.user.SerijskiBrojevi.split(',').map((db: string) => ({
              serialNum: db.split('-')[0],
              name: db.split('-')[1],
            }))
          : [],
        verified: res?.data?.user?.SerijskiBrojevi === '' ? false : true,
        selectedDB: null,
      };
      user.selectedDB = user.verified ? user.databases[0]?.serialNum : null;
      return user;
    } else if (res.status === 400 || res.status === 404) {
      customAlert('Upozorenje', res.data);
      return null;
    } else {
      throw new Error('Greška prilikom povlačenja podataka o korisniku');
    }
  } catch (error) {
    customAlert('Greška', 'Greška prilikom povlačenja podataka o korisniku');
    return null;
  }
};

export const resetPassword = async (
  korisniksk: string,
  sessionToken: string,
  password: string,
  newPassword: string,
): Promise<string | null> => {
  try {
    const res = await axios.put(
      `${API_USERS_URL}/${korisniksk}/password`,
      {
        token: sessionToken,
        password,
        newPassword,
      },
      {
        validateStatus: () => true,
      },
    );

    if (res.status === 202) {
      return 'success';
    } else if (res.status === 400 || res.status === 403) {
      customAlert('Upozorenje', res.data);
      return null;
    } else {
      throw new Error('Greška prilikom izmene lozinke!');
    }
  } catch (error) {
    customAlert('Greška', 'Greška prilikom izmene lozinke!');
    return null;
  }
};

export const updateProfileInfo = async (
  korisniksk: string,
  sessionToken: string,
  contact: string,
): Promise<string | null> => {
  try {
    const res = await axios.put(
      `${API_USERS_URL}/${korisniksk}/profile`,
      {
        token: sessionToken,
        contact,
      },
      {
        validateStatus: () => true,
      },
    );

    if (res.status === 202) {
      return 'success';
    } else if (res.status === 400 || res.status === 403) {
      customAlert('Upozorenje', res.data);
      return null;
    } else {
      throw new Error('Greška prilikom izmene lozinke!');
    }
  } catch (error) {
    customAlert('Greška', 'Greška prilikom ažuriranja podataka!');
    return null;
  }
};

export const deleteUser = async (
  korisniksk: string,
): Promise<string | null> => {
  try {
    const res = await axios.delete(`${API_USERS_URL}/${korisniksk}`, {
      validateStatus: () => true,
    });

    if (res.status === 204) {
      return 'success';
    } else if (res.status === 400 || res.status === 403) {
      customAlert('Upozorenje', res.data);
      return null;
    } else {
      throw new Error('Greška prilikom brisanja korisnika!');
    }
  } catch (error) {
    customAlert('Greška', 'Greška prilikom brisanja korisnika!');
    return null;
  }
};
