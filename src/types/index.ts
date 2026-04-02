export interface MedicineData {
  gtin: string;
  name: string;
  batch: string;
  expiryDate: string;
  isControlled: boolean;
}

export interface UserSession {
  fullName: string;
  role: 'ratownik' | 'koordynator' | 'admin';
  currentTeamId?: string;
}