import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export type InstituteStudentListQuery = {
  status?: string;
  branchId?: string;
  q?: string;
};

function isStudentCodeConflict(e: unknown): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err.code !== 'P2002') return false;
  const t = err.meta?.target;
  return Array.isArray(t) && t.includes('studentCode');
}

function generateStudentCode(): string {
  const y = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `STU-${y}-${rand}`;
}

export type InstituteStudentCreateInput = {
  fullName: string;
  studentCode?: string;
  email?: string;
  phone?: string;
  branchId?: string;
  status?: string;
  gender?: string;
  dateOfBirth?: Date;
  profilePhotoUrl?: string;
  nationalId?: string;
  bloodGroup?: string;
  whatsApp?: string;
  addressLine?: string;
  city?: string;
  country?: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  emergencyContact?: string;
  guardianPhone?: string;
  previousSchool?: string;
  qualification?: string;
  notes?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
};

export type InstituteStudentUpdateInput = Partial<InstituteStudentCreateInput> & {
  branchId?: string | null;
};

function profileData<T extends InstituteStudentCreateInput>(input: T): Pick<
  Prisma.InstituteStudentCreateInput,
  | 'gender'
  | 'dateOfBirth'
  | 'profilePhotoUrl'
  | 'nationalId'
  | 'bloodGroup'
  | 'whatsApp'
  | 'addressLine'
  | 'city'
  | 'country'
  | 'fatherName'
  | 'motherName'
  | 'guardianName'
  | 'emergencyContact'
  | 'guardianPhone'
  | 'previousSchool'
  | 'qualification'
  | 'notes'
  | 'identityDocumentType'
  | 'identityDocumentNumber'
> {
  return {
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
    ...(input.profilePhotoUrl !== undefined ? { profilePhotoUrl: input.profilePhotoUrl } : {}),
    ...(input.nationalId !== undefined ? { nationalId: input.nationalId } : {}),
    ...(input.bloodGroup !== undefined ? { bloodGroup: input.bloodGroup } : {}),
    ...(input.whatsApp !== undefined ? { whatsApp: input.whatsApp } : {}),
    ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.fatherName !== undefined ? { fatherName: input.fatherName } : {}),
    ...(input.motherName !== undefined ? { motherName: input.motherName } : {}),
    ...(input.guardianName !== undefined ? { guardianName: input.guardianName } : {}),
    ...(input.emergencyContact !== undefined ? { emergencyContact: input.emergencyContact } : {}),
    ...(input.guardianPhone !== undefined ? { guardianPhone: input.guardianPhone } : {}),
    ...(input.previousSchool !== undefined ? { previousSchool: input.previousSchool } : {}),
    ...(input.qualification !== undefined ? { qualification: input.qualification } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.identityDocumentType !== undefined ? { identityDocumentType: input.identityDocumentType } : {}),
    ...(input.identityDocumentNumber !== undefined ? { identityDocumentNumber: input.identityDocumentNumber } : {}),
  };
}

export const instituteStudentService = {
  async list(companyId: string, query: InstituteStudentListQuery = {}) {
    const where: Prisma.InstituteStudentWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' } },
              { studentCode: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { whatsApp: { contains: query.q, mode: 'insensitive' } },
              { nationalId: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return prisma.instituteStudent.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async getById(companyId: string, studentId: string) {
    return prisma.instituteStudent.findFirst({
      where: { id: studentId, companyId },
    });
  },

  async create(companyId: string, input: InstituteStudentCreateInput) {
    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, companyId },
        select: { id: true },
      });
      if (!branch) {
        throw Object.assign(new Error('Branch not found for this company'), { statusCode: 400 });
      }
    }

    const manualCode = input.studentCode?.trim();
    const profile = profileData(input);

    const baseData = (studentCode: string | undefined): Prisma.InstituteStudentUncheckedCreateInput => ({
      companyId,
      fullName: input.fullName,
      studentCode,
      email: input.email,
      phone: input.phone,
      branchId: input.branchId,
      status: input.status ?? 'active',
      ...profile,
    });

    if (manualCode) {
      return prisma.instituteStudent.create({
        data: baseData(manualCode),
      });
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateStudentCode();
      try {
        return await prisma.instituteStudent.create({
          data: baseData(code),
        });
      } catch (e: unknown) {
        if (isStudentCodeConflict(e)) continue;
        throw e;
      }
    }

    throw Object.assign(new Error('Could not allocate a unique student code'), { statusCode: 500 });
  },

  async update(companyId: string, studentId: string, patch: InstituteStudentUpdateInput) {
    const existing = await prisma.instituteStudent.findFirst({
      where: { id: studentId, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    }

    if (patch.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: patch.branchId, companyId },
        select: { id: true },
      });
      if (!branch) {
        throw Object.assign(new Error('Branch not found for this company'), { statusCode: 400 });
      }
    }

    const data: Prisma.InstituteStudentUpdateInput = {
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.studentCode !== undefined ? { studentCode: patch.studentCode } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.branchId !== undefined ? { branchId: patch.branchId } : {}),
      ...profileData(patch as InstituteStudentCreateInput),
    };

    return prisma.instituteStudent.update({
      where: { id: studentId },
      data,
    });
  },
};
