import { z } from 'zod';

export const chatRoomIdParamSchema = z.object({
  roomId: z.string().min(1),
});

/**
 * Open or create a room.
 *  - omit both fields → resolves the actor's own branch room
 *    (or the company-wide room for users without a branch).
 *  - `branchId` only → resolves that branch's BRANCH room.
 *  - `withBranchId` → resolves the BRANCH_PAIR room between the actor's branch
 *    (or the supplied `branchId`) and `withBranchId`.
 *  - `kind = "COMPANY"` → resolves the company-wide room.
 */
export const chatRoomOpenBodySchema = z
  .object({
    kind: z.enum(['BRANCH', 'BRANCH_PAIR', 'COMPANY']).optional(),
    branchId: z.string().trim().min(1).optional(),
    withBranchId: z.string().trim().min(1).optional(),
  })
  .refine(
    (v) => !(v.branchId && v.withBranchId && v.branchId === v.withBranchId),
    { message: 'branchId and withBranchId must differ', path: ['withBranchId'] }
  );

export const chatMessageListQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
  before: z.coerce.date().optional(),
});

export const chatMessageCreateBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type ChatRoomOpenBody = z.infer<typeof chatRoomOpenBodySchema>;
export type ChatMessageCreateBody = z.infer<typeof chatMessageCreateBodySchema>;
