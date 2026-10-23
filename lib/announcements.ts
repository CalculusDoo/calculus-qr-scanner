import { Announcement } from './types/Announcement';

export const POPUP_PRIORITY = 1;

export const countUnread = (announcements: Announcement[]): number =>
  announcements.filter((announcement) => !announcement.read).length;

// Prvo nepročitano važno obaveštenje koje u ovoj sesiji još nije prikazano
export const nextPopupAnnouncement = (
  announcements: Announcement[],
  shownIds: ReadonlySet<string>,
): Announcement | null =>
  announcements.find(
    (announcement) =>
      !announcement.read &&
      announcement.priority >= POPUP_PRIORITY &&
      !shownIds.has(announcement.id),
  ) ?? null;

export const withReadState = (
  announcements: Announcement[],
  id: string,
  read: boolean,
): Announcement[] =>
  announcements.map((announcement) =>
    announcement.id === id ? { ...announcement, read } : announcement,
  );

// 2026-10-20 -> 20.10.2026.
export const formatAnnouncementDate = (date: string | null): string => {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}.` : '';
};

export const isSafeAnnouncementLink = (link: string | null): link is string =>
  !!link && /^https?:\/\//i.test(link.trim());
