import type { InstituteStudent, InstituteStudentWritePayload } from '../services/api';

export type StudentFormValues = {
  fullName: string;
  /** Optional student ID card / NIC (maps to `nationalId` on API). */
  nationalId: string;
  gender: string;
  dateOfBirth: string;
  profilePhotoUrl: string;
  identityDocumentType: string;
  identityDocumentNumber: string;
  bloodGroup: string;
  phone: string;
  whatsApp: string;
  email: string;
  addressLine: string;
  city: string;
  country: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  emergencyContact: string;
  guardianPhone: string;
  previousSchool: string;
  qualification: string;
  notes: string;
  status: string;
};

export const emptyStudentForm = (): StudentFormValues => ({
  fullName: '',
  nationalId: '',
  gender: '',
  dateOfBirth: '',
  profilePhotoUrl: '',
  identityDocumentType: '',
  identityDocumentNumber: '',
  bloodGroup: '',
  phone: '',
  whatsApp: '',
  email: '',
  addressLine: '',
  city: '',
  country: '',
  fatherName: '',
  motherName: '',
  guardianName: '',
  emergencyContact: '',
  guardianPhone: '',
  previousSchool: '',
  qualification: '',
  notes: '',
  status: 'active',
});

export function studentFormFromApi(s: InstituteStudent): StudentFormValues {
  const dob = s.dateOfBirth ? String(s.dateOfBirth).slice(0, 10) : '';
  return {
    fullName: s.fullName || '',
    nationalId: s.nationalId || '',
    gender: s.gender || '',
    dateOfBirth: dob,
    profilePhotoUrl: s.profilePhotoUrl || '',
    identityDocumentType: s.identityDocumentType || '',
    identityDocumentNumber: s.identityDocumentNumber || s.nationalId || '',
    bloodGroup: s.bloodGroup || '',
    phone: s.phone || '',
    whatsApp: s.whatsApp || '',
    email: s.email || '',
    addressLine: s.addressLine || '',
    city: s.city || '',
    country: s.country || '',
    fatherName: s.fatherName || '',
    motherName: s.motherName || '',
    guardianName: s.guardianName || '',
    emergencyContact: s.emergencyContact || '',
    guardianPhone: s.guardianPhone || '',
    previousSchool: s.previousSchool || '',
    qualification: s.qualification || '',
    notes: s.notes || '',
    status: s.status || 'active',
  };
}

/** Omit empty strings; coerce DOB to ISO date start-of-day when present. */
export function payloadFromStudentForm(
  v: StudentFormValues,
  opts?: { includeStatus?: boolean }
): InstituteStudentWritePayload {
  const p: InstituteStudentWritePayload = {};
  const set = (key: keyof InstituteStudentWritePayload, val: string | undefined) => {
    const t = val?.trim();
    if (t) (p as Record<string, string>)[key as string] = t;
  };

  set('fullName', v.fullName);
  set('nationalId', v.nationalId);
  set('gender', v.gender);
  set('profilePhotoUrl', v.profilePhotoUrl);
  set('bloodGroup', v.bloodGroup);
  set('phone', v.phone);
  set('whatsApp', v.whatsApp);
  set('email', v.email);
  set('addressLine', v.addressLine);
  set('city', v.city);
  set('country', v.country);
  set('fatherName', v.fatherName);
  set('motherName', v.motherName);
  set('guardianName', v.guardianName);
  set('emergencyContact', v.emergencyContact);
  set('guardianPhone', v.guardianPhone);
  set('previousSchool', v.previousSchool);
  set('qualification', v.qualification);
  set('notes', v.notes);
  set('identityDocumentType', v.identityDocumentType);
  set('identityDocumentNumber', v.identityDocumentNumber);

  if (v.dateOfBirth.trim()) {
    p.dateOfBirth = `${v.dateOfBirth.trim()}T00:00:00.000Z`;
  }
  if (opts?.includeStatus && v.status.trim()) {
    p.status = v.status.trim();
  }

  return p;
}

export function computeAgeFromYmd(ymd: string): number | null {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split('-').map((x) => Number(x));
  if (!y || !m || !d) return null;
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const md = today.getUTCMonth() * 100 + today.getUTCDate() - (birth.getUTCMonth() * 100 + birth.getUTCDate());
  if (md < 0) age -= 1;
  return age >= 0 ? age : null;
}
