import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudentFormValues } from '../../utils/instituteStudentForm';
import { computeAgeFromYmd } from '../../utils/instituteStudentForm';

type Props = {
  values: StudentFormValues;
  onChange: (patch: Partial<StudentFormValues>) => void;
  variant: 'create' | 'edit';
  studentCodeDisplay?: string | null;
  createdAtDisplay?: string | null;
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function InstituteStudentProfileForm({
  values,
  onChange,
  variant,
  studentCodeDisplay,
  createdAtDisplay,
}: Props) {
  const { t } = useTranslation();

  const age = useMemo(() => computeAgeFromYmd(values.dateOfBirth), [values.dateOfBirth]);

  const field = (key: keyof StudentFormValues, labelKey: string, el: ReactNode) => (
    <label key={key} className="institute-field institute-field--grid">
      <span className="institute-field__label">{t(labelKey)}</span>
      {el}
    </label>
  );

  return (
    <div className="institute-form-sections">
      <datalist id="institute-blood-groups">
        {BLOOD_GROUPS.map((bg) => (
          <option key={bg} value={bg} />
        ))}
      </datalist>

      <section className="institute-form-section card institute-form-section--nested">
        <h4 className="institute-form-section__title">{t('institute.secPersonal')}</h4>
        <div className="institute-form-grid">
          {field(
            'fullName',
            'institute.fieldFullName',
            <input
              type="text"
              className="input"
              value={values.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              autoComplete="name"
              maxLength={500}
              required
            />
          )}
          {field(
            'nationalId',
            'institute.fieldNationalId',
            <input
              type="text"
              className="input"
              value={values.nationalId}
              onChange={(e) => onChange({ nationalId: e.target.value })}
              maxLength={64}
            />
          )}
          {variant === 'edit' ? (
            <label className="institute-field institute-field--grid">
              <span className="institute-field__label">{t('institute.fieldStudentId')}</span>
              <input type="text" className="input input--readonly" readOnly value={studentCodeDisplay || '—'} />
              <span className="institute-field__hint">{t('institute.fieldStudentIdHint')}</span>
            </label>
          ) : (
            <div className="institute-field institute-field--grid">
              <span className="institute-field__label">{t('institute.fieldStudentId')}</span>
              <div className="institute-auto-id-preview">{t('institute.fieldStudentIdAuto')}</div>
            </div>
          )}
          {field(
            'gender',
            'institute.fieldGender',
            <select
              className="input"
              value={values.gender}
              onChange={(e) => onChange({ gender: e.target.value })}
            >
              <option value="">{t('institute.selectPlaceholder')}</option>
              <option value="female">{t('institute.genderFemale')}</option>
              <option value="male">{t('institute.genderMale')}</option>
              <option value="other">{t('institute.genderOther')}</option>
              <option value="unspecified">{t('institute.genderUnspecified')}</option>
            </select>
          )}
          {field(
            'dateOfBirth',
            'institute.fieldDob',
            <input
              type="date"
              className="input"
              value={values.dateOfBirth}
              onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            />
          )}
          <label className="institute-field institute-field--grid">
            <span className="institute-field__label">{t('institute.fieldAge')}</span>
            <input
              type="text"
              className="input input--readonly"
              readOnly
              value={age !== null ? String(age) : '—'}
              aria-live="polite"
            />
          </label>
          {field(
            'profilePhotoUrl',
            'institute.fieldPhotoUrl',
            <input
              type="url"
              className="input"
              placeholder="https://"
              value={values.profilePhotoUrl}
              onChange={(e) => onChange({ profilePhotoUrl: e.target.value })}
              maxLength={2048}
            />
          )}
          <div className="institute-form-grid institute-form-grid--span">
            {field(
              'identityDocumentType',
              'institute.fieldIdType',
              <select
                className="input"
                value={values.identityDocumentType}
                onChange={(e) => onChange({ identityDocumentType: e.target.value })}
              >
                <option value="">{t('institute.selectPlaceholder')}</option>
                <option value="student_id">{t('institute.idTypeStudent')}</option>
                <option value="father_id">{t('institute.idTypeFather')}</option>
                <option value="mother_id">{t('institute.idTypeMother')}</option>
                <option value="guardian_id">{t('institute.idTypeGuardian')}</option>
                <option value="passport">{t('institute.idTypePassport')}</option>
              </select>
            )}
            {field(
              'identityDocumentNumber',
              'institute.fieldIdNumber',
              <input
                type="text"
                className="input"
                value={values.identityDocumentNumber}
                onChange={(e) => onChange({ identityDocumentNumber: e.target.value })}
                maxLength={128}
              />
            )}
          </div>
          {field(
            'bloodGroup',
            'institute.fieldBloodGroup',
            <input
              type="text"
              className="input"
              list="institute-blood-groups"
              value={values.bloodGroup}
              onChange={(e) => onChange({ bloodGroup: e.target.value })}
              maxLength={16}
            />
          )}
        </div>
      </section>

      <section className="institute-form-section card institute-form-section--nested">
        <h4 className="institute-form-section__title">{t('institute.secContact')}</h4>
        <div className="institute-form-grid">
          {field(
            'phone',
            'institute.colPhone',
            <input
              type="tel"
              className="input"
              value={values.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              maxLength={64}
            />
          )}
          {field(
            'whatsApp',
            'institute.fieldWhatsApp',
            <input
              type="tel"
              className="input"
              value={values.whatsApp}
              onChange={(e) => onChange({ whatsApp: e.target.value })}
              maxLength={64}
            />
          )}
          {field(
            'email',
            'institute.fieldEmail',
            <input
              type="email"
              className="input"
              value={values.email}
              onChange={(e) => onChange({ email: e.target.value })}
              maxLength={320}
            />
          )}
          {field(
            'addressLine',
            'institute.fieldAddress',
            <input
              type="text"
              className="input"
              value={values.addressLine}
              onChange={(e) => onChange({ addressLine: e.target.value })}
              maxLength={500}
            />
          )}
          {field(
            'city',
            'institute.fieldCity',
            <input type="text" className="input" value={values.city} onChange={(e) => onChange({ city: e.target.value })} maxLength={120} />
          )}
          {field(
            'country',
            'institute.fieldCountry',
            <input
              type="text"
              className="input"
              value={values.country}
              onChange={(e) => onChange({ country: e.target.value })}
              maxLength={120}
            />
          )}
        </div>
      </section>

      <section className="institute-form-section card institute-form-section--nested">
        <h4 className="institute-form-section__title">{t('institute.secGuardian')}</h4>
        <div className="institute-form-grid">
          {field(
            'fatherName',
            'institute.fieldFather',
            <input
              type="text"
              className="input"
              value={values.fatherName}
              onChange={(e) => onChange({ fatherName: e.target.value })}
              maxLength={200}
            />
          )}
          {field(
            'motherName',
            'institute.fieldMother',
            <input
              type="text"
              className="input"
              value={values.motherName}
              onChange={(e) => onChange({ motherName: e.target.value })}
              maxLength={200}
            />
          )}
          {field(
            'guardianName',
            'institute.fieldGuardian',
            <input
              type="text"
              className="input"
              value={values.guardianName}
              onChange={(e) => onChange({ guardianName: e.target.value })}
              maxLength={200}
            />
          )}
          {field(
            'emergencyContact',
            'institute.fieldEmergency',
            <input
              type="text"
              className="input"
              value={values.emergencyContact}
              onChange={(e) => onChange({ emergencyContact: e.target.value })}
              maxLength={200}
            />
          )}
          {field(
            'guardianPhone',
            'institute.fieldGuardianPhone',
            <input
              type="tel"
              className="input"
              value={values.guardianPhone}
              onChange={(e) => onChange({ guardianPhone: e.target.value })}
              maxLength={64}
            />
          )}
        </div>
      </section>

      <section className="institute-form-section card institute-form-section--nested">
        <h4 className="institute-form-section__title">{t('institute.secEducation')}</h4>
        <div className="institute-form-grid">
          {field(
            'previousSchool',
            'institute.fieldPrevSchool',
            <input
              type="text"
              className="input"
              value={values.previousSchool}
              onChange={(e) => onChange({ previousSchool: e.target.value })}
              maxLength={300}
            />
          )}
          {field(
            'qualification',
            'institute.fieldQualification',
            <input
              type="text"
              className="input"
              value={values.qualification}
              onChange={(e) => onChange({ qualification: e.target.value })}
              maxLength={300}
            />
          )}
          {field(
            'notes',
            'institute.fieldNotes',
            <textarea
              className="input institute-textarea"
              rows={3}
              value={values.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              maxLength={10000}
            />
          )}
        </div>
      </section>

      {variant === 'edit' ? (
        <section className="institute-form-section card institute-form-section--nested">
          <h4 className="institute-form-section__title">{t('institute.secSystem')}</h4>
          <div className="institute-form-grid">
            {field(
              'status',
              'institute.colStatus',
              <select className="input" value={values.status} onChange={(e) => onChange({ status: e.target.value })}>
                <option value="active">{t('institute.statusActive')}</option>
                <option value="completed">{t('institute.statusCompleted')}</option>
                <option value="discontinued">{t('institute.statusDiscontinued')}</option>
                <option value="suspended">{t('institute.statusSuspended')}</option>
                <option value="leave">{t('institute.statusLeave')}</option>
                <option value="graduated">{t('institute.statusGraduated')}</option>
                <option value="inactive">{t('institute.statusInactive')}</option>
              </select>
            )}
            <label className="institute-field institute-field--grid">
              <span className="institute-field__label">{t('institute.fieldCreatedAt')}</span>
              <input type="text" className="input input--readonly" readOnly value={createdAtDisplay || '—'} />
            </label>
          </div>
        </section>
      ) : null}
    </div>
  );
}
