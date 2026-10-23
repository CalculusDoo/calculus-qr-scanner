import axios from 'axios';

import {
  countUnread,
  formatAnnouncementDate,
  isSafeAnnouncementLink,
  nextPopupAnnouncement,
  withReadState,
} from '@/lib/announcements';
import {
  getAnnouncements,
  markAnnouncementRead,
} from '@/lib/calculusWS/announcementServices';
import { Announcement } from '@/lib/types/Announcement';

jest.mock('axios');
const get = axios.get as jest.MockedFunction<typeof axios.get>;
const put = axios.put as jest.MockedFunction<typeof axios.put>;

const announcement = (overrides: Partial<Announcement>): Announcement => ({
  id: '1',
  title: 'Naslov',
  body: 'Tekst',
  type: 'U',
  priority: 0,
  link: null,
  validFrom: '2026-10-20',
  validTo: null,
  createdAt: null,
  read: false,
  ...overrides,
});

describe('announcement helpers', () => {
  it('counts only unread announcements', () => {
    expect(
      countUnread([
        announcement({ id: '1' }),
        announcement({ id: '2', read: true }),
        announcement({ id: '3' }),
      ]),
    ).toBe(2);
  });

  it('picks the first unread important announcement not shown yet', () => {
    const list = [
      announcement({ id: '1', priority: 1, read: true }),
      announcement({ id: '2', priority: 0 }),
      announcement({ id: '3', priority: 1 }),
      announcement({ id: '4', priority: 2 }),
    ];
    expect(nextPopupAnnouncement(list, new Set())?.id).toBe('3');
    expect(nextPopupAnnouncement(list, new Set(['3']))?.id).toBe('4');
    expect(nextPopupAnnouncement(list, new Set(['3', '4']))).toBeNull();
  });

  it('changes the read state of one announcement only', () => {
    const list = [announcement({ id: '1' }), announcement({ id: '2' })];
    const updated = withReadState(list, '2', true);
    expect(updated.map((a) => a.read)).toEqual([false, true]);
    expect(list[1].read).toBe(false);
  });

  it('formats dates the way they are shown in the app', () => {
    expect(formatAnnouncementDate('2026-10-20')).toBe('20.10.2026.');
    expect(formatAnnouncementDate(null)).toBe('');
    expect(formatAnnouncementDate('not a date')).toBe('');
  });

  it('opens only http(s) links', () => {
    expect(isSafeAnnouncementLink('https://calculus.rs')).toBe(true);
    expect(isSafeAnnouncementLink(' http://calculus.rs ')).toBe(true);
    expect(isSafeAnnouncementLink('javascript:alert(1)')).toBe(false);
    expect(isSafeAnnouncementLink('tel:123')).toBe(false);
    expect(isSafeAnnouncementLink(null)).toBe(false);
  });
});

describe('announcement services', () => {
  beforeEach(() => jest.resetAllMocks());

  it('sends the session token in a header and returns the list', async () => {
    const list = [announcement({})];
    get.mockResolvedValue({ status: 200, data: { announcements: list } });

    await expect(getAnnouncements('42', 'token')).resolves.toEqual(list);
    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/\/announcements\/42$/),
      expect.objectContaining({ headers: { 'x-session-token': 'token' } }),
    );
  });

  it('returns null instead of throwing when announcements are unavailable', async () => {
    get.mockResolvedValue({ status: 401, data: 'Sesija je istekla' });
    await expect(getAnnouncements('42', 'token')).resolves.toBeNull();

    get.mockRejectedValue(new Error('Network unavailable'));
    await expect(getAnnouncements('42', 'token')).resolves.toBeNull();
  });

  it('marks an announcement read and reports failures', async () => {
    put.mockResolvedValue({ status: 200, data: { id: '7', read: true } });
    await expect(markAnnouncementRead('7', '42', 'token')).resolves.toBe(true);
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/\/announcements\/7\/read$/),
      { userId: '42', token: 'token', read: true },
      expect.any(Object),
    );

    put.mockResolvedValue({ status: 403, data: 'Niste autorizovani' });
    await expect(markAnnouncementRead('7', '42', 'token')).resolves.toBe(false);

    put.mockRejectedValue(new Error('Network unavailable'));
    await expect(markAnnouncementRead('7', '42', 'token', false)).resolves.toBe(false);
  });
});
