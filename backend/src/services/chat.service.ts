import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * Internal Branch Chat — service layer.
 *
 * The service is intentionally tenant-aware via explicit `companyId` arguments
 * instead of `requireTenantCompanyId()`. This is so it can be invoked from both
 * HTTP requests (which have ALS context) AND socket.io handlers (which run
 * outside the HTTP request lifecycle).
 */

export type ChatRoomKind = 'BRANCH' | 'BRANCH_PAIR' | 'COMPANY';

const ROOM_INCLUDE = {
  branch: { select: { id: true, name: true } },
  branchA: { select: { id: true, name: true } },
  branchB: { select: { id: true, name: true } },
} satisfies Prisma.ChatRoomInclude;

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, email: true } },
  senderBranch: { select: { id: true, name: true } },
} satisfies Prisma.ChatMessageInclude;

export type ChatRoomDTO = {
  id: string;
  kind: ChatRoomKind;
  name: string;
  branchId: string | null;
  branchAId: string | null;
  branchBId: string | null;
  /** Display members for the UI ("from <branch>", "<branchA> ↔ <branchB>", or "Everyone"). */
  participants: { id: string; name: string }[];
  updatedAt: Date;
};

export type ChatMessageDTO = {
  id: string;
  chatRoomId: string;
  body: string;
  createdAt: Date;
  sender: { id: string; name: string; email: string } | null;
  senderBranch: { id: string; name: string } | null;
};

type RoomWithBranches = Prisma.ChatRoomGetPayload<{ include: typeof ROOM_INCLUDE }>;
type MessageWithRefs = Prisma.ChatMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

function toRoomDTO(r: RoomWithBranches): ChatRoomDTO {
  const participants: { id: string; name: string }[] = [];
  if (r.branch) participants.push({ id: r.branch.id, name: r.branch.name });
  if (r.branchA) participants.push({ id: r.branchA.id, name: r.branchA.name });
  if (r.branchB) participants.push({ id: r.branchB.id, name: r.branchB.name });
  return {
    id: r.id,
    kind: r.kind as ChatRoomKind,
    name: r.name,
    branchId: r.branchId ?? null,
    branchAId: r.branchAId ?? null,
    branchBId: r.branchBId ?? null,
    participants,
    updatedAt: r.updatedAt,
  };
}

function toMessageDTO(m: MessageWithRefs): ChatMessageDTO {
  return {
    id: m.id,
    chatRoomId: m.chatRoomId,
    body: m.body,
    createdAt: m.createdAt,
    sender: m.sender ?? null,
    senderBranch: m.senderBranch ?? null,
  };
}

/** Sort branch ids ascending so a pair is always uniquely keyed. */
function sortPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export interface ChatActor {
  userId: string;
  companyId: string;
  branchId: string | null;
  branchRole?: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER';
  isSystemAdmin?: boolean;
}

const MESSAGE_BODY_MAX = 4000;

function isSuperLike(actor: ChatActor): boolean {
  return Boolean(actor.isSystemAdmin) || actor.branchRole === 'SUPER_ADMIN' || !actor.branchId;
}

export const chatService = {
  /**
   * Get-or-create the company-wide channel. Every employee can read/write here
   * regardless of branch — useful for announcements & cross-branch coordination.
   */
  async ensureCompanyRoom(companyId: string): Promise<ChatRoomDTO> {
    const existing = await prisma.chatRoom.findFirst({
      where: { companyId, kind: 'COMPANY' },
      include: ROOM_INCLUDE,
    });
    if (existing) return toRoomDTO(existing);

    const created = await prisma.chatRoom.create({
      data: { companyId, kind: 'COMPANY', name: 'Company-wide' },
      include: ROOM_INCLUDE,
    });
    return toRoomDTO(created);
  },

  /**
   * Get-or-create a single-branch channel. Used as the "internal team chat" for
   * a branch — all users assigned to that branch see it.
   */
  async ensureBranchRoom(companyId: string, branchId: string): Promise<ChatRoomDTO> {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId },
      select: { id: true, name: true },
    });
    if (!branch) throw new Error('Branch not found');

    const existing = await prisma.chatRoom.findFirst({
      where: { companyId, kind: 'BRANCH', branchId },
      include: ROOM_INCLUDE,
    });
    if (existing) return toRoomDTO(existing);

    const created = await prisma.chatRoom.create({
      data: { companyId, kind: 'BRANCH', branchId, name: branch.name },
      include: ROOM_INCLUDE,
    });
    return toRoomDTO(created);
  },

  /**
   * Get-or-create a 1:1 channel between two branches. Symmetric — passing
   * `(A, B)` and `(B, A)` always yields the same row.
   */
  async ensureBranchPairRoom(
    companyId: string,
    branchA: string,
    branchB: string
  ): Promise<ChatRoomDTO> {
    if (branchA === branchB) throw new Error('Cannot pair a branch with itself');
    const [aId, bId] = sortPair(branchA, branchB);

    const branches = await prisma.branch.findMany({
      where: { id: { in: [aId, bId] }, companyId },
      select: { id: true, name: true },
    });
    if (branches.length !== 2) throw new Error('One or both branches not found');

    const existing = await prisma.chatRoom.findFirst({
      where: { companyId, kind: 'BRANCH_PAIR', branchAId: aId, branchBId: bId },
      include: ROOM_INCLUDE,
    });
    if (existing) return toRoomDTO(existing);

    const aName = branches.find((b) => b.id === aId)?.name ?? 'Branch';
    const bName = branches.find((b) => b.id === bId)?.name ?? 'Branch';

    const created = await prisma.chatRoom.create({
      data: {
        companyId,
        kind: 'BRANCH_PAIR',
        branchAId: aId,
        branchBId: bId,
        name: `${aName} ↔ ${bName}`,
      },
      include: ROOM_INCLUDE,
    });
    return toRoomDTO(created);
  },

  /**
   * List rooms the actor can see:
   *  - Company-wide (auto-created on first use)
   *  - Their own branch's room (auto-created)
   *  - Any pair room their branch participates in
   *  - Super admins see every room in the company
   */
  async listRoomsForUser(actor: ChatActor): Promise<ChatRoomDTO[]> {
    const { companyId } = actor;

    await this.ensureCompanyRoom(companyId);
    if (actor.branchId) {
      await this.ensureBranchRoom(companyId, actor.branchId);
    }

    const where: Prisma.ChatRoomWhereInput = isSuperLike(actor)
      ? { companyId }
      : {
          companyId,
          OR: [
            { kind: 'COMPANY' },
            { kind: 'BRANCH', branchId: actor.branchId ?? '__none__' },
            { kind: 'BRANCH_PAIR', OR: [{ branchAId: actor.branchId }, { branchBId: actor.branchId }] },
          ],
        };

    const rows = await prisma.chatRoom.findMany({
      where,
      include: ROOM_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return rows.map(toRoomDTO);
  },

  /**
   * Authorize an actor against a room. Throws on mismatch; returns the room on
   * success. Used by both REST endpoints and socket handlers.
   */
  async assertAccess(actor: ChatActor, roomId: string): Promise<ChatRoomDTO> {
    const room = await prisma.chatRoom.findFirst({
      where: { id: roomId, companyId: actor.companyId },
      include: ROOM_INCLUDE,
    });
    if (!room) {
      const err = new Error('Chat room not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    if (isSuperLike(actor)) return toRoomDTO(room);

    const ok =
      room.kind === 'COMPANY' ||
      (room.kind === 'BRANCH' && room.branchId === actor.branchId) ||
      (room.kind === 'BRANCH_PAIR' &&
        actor.branchId != null &&
        (room.branchAId === actor.branchId || room.branchBId === actor.branchId));

    if (!ok) {
      const err = new Error('Forbidden') as Error & { statusCode?: number };
      err.statusCode = 403;
      throw err;
    }
    return toRoomDTO(room);
  },

  /**
   * Page through messages newest-first. `before` is a `createdAt` cursor — pass
   * the oldest currently-displayed message's `createdAt` to load the next page.
   */
  async listMessages(
    actor: ChatActor,
    roomId: string,
    opts?: { take?: number; before?: Date | string }
  ): Promise<ChatMessageDTO[]> {
    await this.assertAccess(actor, roomId);
    const take = Math.min(200, Math.max(1, Number(opts?.take ?? 50)));
    const beforeDate = opts?.before ? new Date(opts.before) : undefined;

    const rows = await prisma.chatMessage.findMany({
      where: {
        chatRoomId: roomId,
        companyId: actor.companyId,
        ...(beforeDate && !Number.isNaN(beforeDate.getTime())
          ? { createdAt: { lt: beforeDate } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: MESSAGE_INCLUDE,
    });

    // Return ascending so the UI can simply append on the bottom.
    return rows.map(toMessageDTO).reverse();
  },

  /**
   * Persist a new message and bump the room's `updatedAt` so list ordering
   * stays accurate without an extra query.
   */
  async createMessage(
    actor: ChatActor,
    roomId: string,
    bodyRaw: string
  ): Promise<ChatMessageDTO> {
    await this.assertAccess(actor, roomId);

    const body = String(bodyRaw ?? '').trim();
    if (!body) {
      const err = new Error('Message cannot be empty') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    if (body.length > MESSAGE_BODY_MAX) {
      const err = new Error(
        `Message exceeds ${MESSAGE_BODY_MAX} characters`
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    // Use a transaction so the room timestamp + the message are consistent.
    const created = await prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          companyId: actor.companyId,
          chatRoomId: roomId,
          senderId: actor.userId,
          senderBranchId: actor.branchId ?? null,
          body,
        },
        include: MESSAGE_INCLUDE,
      });
      await tx.chatRoom.update({
        where: { id: roomId },
        data: { updatedAt: new Date() },
      });
      return message;
    });

    return toMessageDTO(created);
  },
};
