export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  // 0 = obično, 1+ = važno (prikazuje se i kao popup)
  priority: number;
  link: string | null;
  // YYYY-MM-DD
  validFrom: string | null;
  validTo: string | null;
  createdAt: string | null;
  read: boolean;
}
