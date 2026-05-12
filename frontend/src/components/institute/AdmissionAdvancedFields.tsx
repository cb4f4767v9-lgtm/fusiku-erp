import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudentFormValues } from '../../utils/instituteStudentForm';
import { computeAgeFromYmd } from '../../utils/instituteStudentForm';

type Props = {
  values: StudentFormValues;
  onChange: (patch: Partial<StudentFormValues>) => void;
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Secondary profile fields — keep admission modal primary flow minimal. */
export function AdmissionAdvancedFields({ values, onChange }: Props) {
  const { t } = useTranslation();
  const age = useMemo(() => computeAgeFromYmd(values.dateOfBirth), [values.dateOfBirth]);

  return (
    <div className="institute-admission-advanced">
      <datalist id="institute-blood-groups-admission">
        {BLOOD_GROUPS.map((bg) => (
          <option key={bg} value={bg} />
        ))}
      </datalist>

      <div className="institute-form-grid">
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldGender')}</span>
          <select className="input input--lg" value={values.gender} onChange={(e) => onChange({ gender: e.target.value })}>
            <option value="">{t('institute.selectPlaceholder')}</option>
            <option value="female">{t('institute.genderFemale')}</option>
            <option value="male">{t('institute.genderMale')}</option>
            <option value="other">{t('institute.genderOther')}</option>
            <option value="unspecified">{t('institute.genderUnspecified')}</option>
          </select>
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldDob')}</span>
          <input
            type="date"
            className="input input--lg"
            value={values.dateOfBirth}
            onChange={(e) => onChange({ dateOfBirth: e.target.value })}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldAge')}</span>
          <input type="text" className="input input--lg input--readonly" readOnly value={age !== null ? String(age) : '—'} />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldPhotoUrl')}</span>
          <input
            type="url"
            className="input input--lg"
            placeholder="https://"
            value={values.profilePhotoUrl}
            onChange={(e) => onChange({ profilePhotoUrl: e.target.value })}
            maxLength={2048}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldBloodGroup')}</span>
          <input
            type="text"
            className="input input--lg"
            list="institute-blood-groups-admission"
            value={values.bloodGroup}
            onChange={(e) => onChange({ bloodGroup: e.target.value })}
            maxLength={16}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldWhatsApp')}</span>
          <input
            type="tel"
            className="input input--lg"
            value={values.whatsApp}
            onChange={(e) => onChange({ whatsApp: e.target.value })}
            maxLength={64}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldEmail')}</span>
          <input
            type="email"
            className="input input--lg"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
            maxLength={320}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldAddress')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.addressLine}
            onChange={(e) => onChange({ addressLine: e.target.value })}
            maxLength={500}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldCity')}</span>
          <input type="text" className="input input--lg" value={values.city} onChange={(e) => onChange({ city: e.target.value })} maxLength={120} />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldCountry')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.country}
            onChange={(e) => onChange({ country: e.target.value })}
            maxLength={120}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldFather')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.fatherName}
            onChange={(e) => onChange({ fatherName: e.target.value })}
            maxLength={200}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldMother')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.motherName}
            onChange={(e) => onChange({ motherName: e.target.value })}
            maxLength={200}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldGuardian')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.guardianName}
            onChange={(e) => onChange({ guardianName: e.target.value })}
            maxLength={200}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldEmergency')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.emergencyContact}
            onChange={(e) => onChange({ emergencyContact: e.target.value })}
            maxLength={200}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldPrevSchool')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.previousSchool}
            onChange={(e) => onChange({ previousSchool: e.target.value })}
            maxLength={300}
          />
        </label>
        <label className="institute-field institute-field--grid">
          <span className="institute-field__label">{t('institute.fieldQualification')}</span>
          <input
            type="text"
            className="input input--lg"
            value={values.qualification}
            onChange={(e) => onChange({ qualification: e.target.value })}
            maxLength={300}
          />
        </label>
        <label className="institute-field institute-field--grid institute-field--full">
          <span className="institute-field__label">{t('institute.fieldNotes')}</span>
          <textarea
            className="input institute-textarea input--lg"
            rows={3}
            value={values.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            maxLength={10000}
          />
        </label>
      </div>
    </div>
  );
}
