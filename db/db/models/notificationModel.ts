// แจ้งเตือนในเว็บ — สร้างจาก backend ตอนสถานะการยืมเปลี่ยน และจากงานเตือนครบกำหนด

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { notificationsTable, type NewNotification } from "@db/schema.js";
import { toIso, toIsoOrNull } from "@db/models/helpers.js";

export type NotificationRow = {
  id: number;
  userId: string;
  borrowId: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type Raw = typeof notificationsTable.$inferSelect;

const toRow = (r: Raw): NotificationRow => ({
  ...r,
  readAt: toIsoOrNull(r.readAt),
  createdAt: toIso(r.createdAt),
});

export const notificationModel = {
  /**
   * สร้างแจ้งเตือน — แถวที่ซ้ำ (user, borrow, type เดิม) จะถูกข้าม
   * คืนเฉพาะแถวที่สร้างใหม่จริง ให้ผู้เรียกส่งอีเมลเฉพาะของใหม่
   */
  async notify(rows: NewNotification[]): Promise<NotificationRow[]> {
    if (rows.length === 0) return [];
    const inserted = await dbClient
      .insert(notificationsTable)
      .values(rows)
      .onConflictDoNothing()
      .returning();
    return inserted.map(toRow);
  },

  async listForUser(userId: string, limit = 30): Promise<NotificationRow[]> {
    const rows = await dbClient
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id))
      .limit(limit);
    return rows.map(toRow);
  },

  async unreadCount(userId: string): Promise<number> {
    const [row] = await dbClient
      .select({ n: count() })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)));
    return row?.n ?? 0;
  },

  /** อ่านได้เฉพาะของตัวเอง — id ของคนอื่นจะไม่มีผล */
  async markRead(userId: string, id: number): Promise<void> {
    await dbClient
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.readAt),
        ),
      );
  },

  async markAllRead(userId: string): Promise<void> {
    await dbClient
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)));
  },
};

export default notificationModel;
