import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { attachments, db, members, projects } from "@roster/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  absoluteAttachmentUrl,
  type AttachmentRefusal,
  attachmentRefusal,
  attachmentUrl,
  imageSize,
  isSafeStorageKey,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type MessageAttachment,
  sanitizeFilename,
  sniffMimeType,
  storageKeyFor,
  textWithAttachments,
} from "../lib/attachments";
import { keyHolderMember, verifyApiKey } from "./api-keys";
import { requireOrgProject } from "./channels";

export type { MessageAttachment } from "../lib/attachments";
export {
  absoluteAttachmentUrl,
  attachmentBrief,
  attachmentUrl,
  textWithAttachments,
} from "../lib/attachments";

export type UploadResult =
  | { refusal: AttachmentRefusal | "no-access" }
  | { attachment: MessageAttachment };

export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".uploads");
}

function toMessageAttachment(row: {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
}): MessageAttachment {
  return { ...row, url: attachmentUrl(row.id) };
}

async function memberOfProject(args: { userId: string; projectId: string }) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, args.projectId),
    columns: { id: true, organizationId: true },
  });
  if (!project) return null;

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, project.organizationId),
      eq(members.userId, args.userId),
    ),
    columns: { id: true, role: true },
  });
  if (!member) return null;

  const visible = await requireOrgProject({
    organizationId: project.organizationId,
    memberId: member.id,
    role: member.role,
    projectId: project.id,
  });
  if (!visible) return null;

  return { organizationId: project.organizationId, member };
}

export async function uploadAttachment(args: {
  userId: string;
  projectId: string;
  filename: string;
  bytes: Uint8Array;
}): Promise<UploadResult> {
  const access = await memberOfProject({
    userId: args.userId,
    projectId: args.projectId,
  });
  if (!access) return { refusal: "no-access" };

  const refusal = attachmentRefusal(args.bytes);
  if (refusal) return { refusal };

  const mimeType = sniffMimeType(args.bytes) as string;
  const id = randomUUID();
  const storageKey = storageKeyFor({
    organizationId: access.organizationId,
    attachmentId: id,
    mimeType,
  });
  const size = imageSize(args.bytes);

  const target = path.join(uploadsRoot(), storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, args.bytes);

  try {
    const [row] = await db
      .insert(attachments)
      .values({
        id,
        organizationId: access.organizationId,
        projectId: args.projectId,
        uploaderMemberId: access.member.id,
        filename: sanitizeFilename(args.filename),
        mimeType,
        size: args.bytes.length,
        storageKey,
        width: size?.width ?? null,
        height: size?.height ?? null,
      })
      .returning({
        id: attachments.id,
        filename: attachments.filename,
        mimeType: attachments.mimeType,
        size: attachments.size,
        width: attachments.width,
        height: attachments.height,
      });

    if (!row) throw new Error("Attachment could not be stored.");
    return { attachment: toMessageAttachment(row) };
  } catch (cause) {
    await unlink(target).catch(() => {});
    throw cause;
  }
}

export interface ReadableAttachment {
  filename: string;
  mimeType: string;
  size: number;
  bytes: Buffer;
}

async function readForMember(args: {
  attachmentId: string;
  member: { id: string; role: string };
  organizationId: string;
}): Promise<ReadableAttachment | null> {
  const row = await db.query.attachments.findFirst({
    where: eq(attachments.id, args.attachmentId),
  });
  if (!row) return null;
  if (row.organizationId !== args.organizationId) return null;

  const visible = await requireOrgProject({
    organizationId: row.organizationId,
    memberId: args.member.id,
    role: args.member.role,
    projectId: row.projectId,
  });
  if (!visible) return null;

  if (!isSafeStorageKey(row.storageKey)) return null;

  try {
    const bytes = await readFile(path.join(uploadsRoot(), row.storageKey));
    return {
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      bytes,
    };
  } catch {
    return null;
  }
}

export async function readAttachment(args: {
  userId: string;
  attachmentId: string;
}): Promise<ReadableAttachment | null> {
  const row = await db.query.attachments.findFirst({
    where: eq(attachments.id, args.attachmentId),
    columns: { organizationId: true },
  });
  if (!row) return null;

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, row.organizationId),
      eq(members.userId, args.userId),
    ),
    columns: { id: true, role: true },
  });
  if (!member) return null;

  return readForMember({
    attachmentId: args.attachmentId,
    member,
    organizationId: row.organizationId,
  });
}

export async function readAttachmentWithKey(args: {
  token: string;
  attachmentId: string;
}): Promise<ReadableAttachment | "unauthorized" | null> {
  const holder = await verifyApiKey(args.token);
  if (!holder) return "unauthorized";

  const member = await keyHolderMember(holder);
  if (!member) return "unauthorized";

  return readForMember({
    attachmentId: args.attachmentId,
    member,
    organizationId: holder.organizationId,
  });
}

export async function bindAttachments(args: {
  attachmentIds: string[];
  messageId: string;
  projectId: string;
  uploaderMemberId: string;
}): Promise<void> {
  const ids = args.attachmentIds.slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  if (ids.length === 0) return;

  await db
    .update(attachments)
    .set({ messageId: args.messageId })
    .where(
      and(
        inArray(attachments.id, ids),
        eq(attachments.projectId, args.projectId),
        eq(attachments.uploaderMemberId, args.uploaderMemberId),
        isNull(attachments.messageId),
      ),
    );
}

export async function attachmentsForMessages(
  messageIds: string[],
): Promise<Map<string, MessageAttachment[]>> {
  const grouped = new Map<string, MessageAttachment[]>();
  if (messageIds.length === 0) return grouped;

  const rows = await db
    .select({
      id: attachments.id,
      messageId: attachments.messageId,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      size: attachments.size,
      width: attachments.width,
      height: attachments.height,
    })
    .from(attachments)
    .where(inArray(attachments.messageId, messageIds))
    .orderBy(attachments.createdAt);

  for (const { messageId, ...row } of rows) {
    if (!messageId) continue;
    const list = grouped.get(messageId) ?? [];
    list.push(toMessageAttachment(row));
    grouped.set(messageId, list);
  }

  return grouped;
}
