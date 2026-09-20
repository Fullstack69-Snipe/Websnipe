// จัดการ login ด้วย OAuth และ session
//
// การจับคู่บัญชีทำสองชั้นตามลำดับ:
//   1) หา user_identities ด้วย (provider, providerAccountId) — แม่นที่สุด ไม่เปลี่ยนตามเวลา
//   2) ไม่เจอ -> หา users ด้วย email ที่ผู้ให้บริการยืนยันแล้ว
//      เจอ = คนเดิมที่เคยมีอยู่ (เช่น u1..u4 จาก seed) ผูก identity เพิ่มให้
//   3) ยังไม่เจอ -> สร้างผู้ใช้ใหม่ role = 'user'
//
// ใช้ email จับคู่ได้เฉพาะ email ที่ provider ยืนยันแล้วเท่านั้น
// ถ้ายอมรับ email ที่ยังไม่ยืนยัน จะยึดบัญชีคนอื่นได้ด้วยการสมัคร email ซ้ำ

import crypto from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import {
  sessionsTable,
  userIdentitiesTable,
  usersTable,
  type AuthProvider,
  type Role,
} from "@db/schema.js";
import { firstOrUndefined } from "@db/models/helpers.js";

export type OAuthProfile = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null;
};

const userColumns = {
  id: usersTable.id,
  email: usersTable.email,
  fullName: usersTable.fullName,
  role: usersTable.role,
  avatarUrl: usersTable.avatarUrl,
};

// อายุ session เริ่มต้น 30 วัน
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;

// อีเมลที่ได้สิทธิ์ admin อัตโนมัติตอน login (คั่นด้วย comma)
//
// จำเป็นเพราะ: เปิดให้ใครก็สมัครได้ ทุกคนจึงได้ role 'user' หมด
// ถ้าไม่มีตัวนี้จะไม่มีใครเป็น admin ได้เลย นอกจากเข้าไปแก้ในฐานข้อมูลเอง
// (ผู้ใช้ admin@example.com จาก seed เป็นแค่ข้อมูลตัวอย่าง ไม่มีใคร login ได้จริง)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const isBootstrapAdmin = (email: string) =>
  ADMIN_EMAILS.includes(email.trim().toLowerCase());

export const authModel = {
  /**
   * หา (หรือสร้าง) ผู้ใช้จากโปรไฟล์ที่ได้จาก provider แล้วผูก identity ให้เรียบร้อย
   * ทำในทรานแซกชันเดียว กันสองคำขอพร้อมกันสร้างผู้ใช้ซ้ำ
   */
  async findOrCreateFromOAuth(profile: OAuthProfile): Promise<AuthUser> {
    return dbClient.transaction(async (tx) => {
      // 1) เคย login ด้วยบัญชีนี้แล้วหรือยัง
      const linked = await tx
        .select(userColumns)
        .from(userIdentitiesTable)
        .innerJoin(usersTable, eq(usersTable.id, userIdentitiesTable.userId))
        .where(
          and(
            eq(userIdentitiesTable.provider, profile.provider),
            eq(
              userIdentitiesTable.providerAccountId,
              profile.providerAccountId,
            ),
          ),
        )
        .limit(1);

      const existingByIdentity = firstOrUndefined(linked);
      if (existingByIdentity) {
        // อัปเดตชื่อ/รูปให้ตรงกับฝั่ง provider เสมอ
        // และถ้าอยู่ใน ADMIN_EMAILS ก็ยกระดับให้ทุกครั้ง (ใช้กู้สิทธิ์ตัวเองได้)
        const promote =
          isBootstrapAdmin(existingByIdentity.email) &&
          existingByIdentity.role !== "admin";

        await tx
          .update(usersTable)
          .set({
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            ...(promote ? { role: "admin" as const } : {}),
          })
          .where(eq(usersTable.id, existingByIdentity.id));

        return {
          ...existingByIdentity,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          role: promote ? "admin" : existingByIdentity.role,
        };
      }

      // 2) มีผู้ใช้ email นี้อยู่แล้วไหม (เทียบแบบไม่สนตัวพิมพ์ ให้ตรงกับ unique index)
      const byEmail = await tx
        .select(userColumns)
        .from(usersTable)
        .where(sql`lower(${usersTable.email}) = lower(${profile.email})`)
        .limit(1);

      let user = firstOrUndefined(byEmail);

      // ผู้ใช้เดิมที่อยู่ใน ADMIN_EMAILS แต่ role ยังไม่ใช่ admin -> ยกระดับให้
      if (user && isBootstrapAdmin(user.email) && user.role !== "admin") {
        await tx
          .update(usersTable)
          .set({ role: "admin" })
          .where(eq(usersTable.id, user.id));
        user = { ...user, role: "admin" };
      }

      // 3) ไม่มีเลย -> สร้างใหม่ role = 'user'
      if (!user) {
        const inserted = await tx
          .insert(usersTable)
          .values({
            id: crypto.randomUUID(),
            email: profile.email,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            role: isBootstrapAdmin(profile.email) ? "admin" : "user",
          })
          .returning(userColumns);

        user = inserted[0]!;
      }

      // ผูก identity ให้ผู้ใช้คนนี้
      //
      // ใช้ upsert เพราะมี unique (user_id, provider): ถ้าผู้ใช้คนนี้เคยผูก provider เจ้านี้ไว้
      // ด้วย account id เก่า (เช่นย้ายไปใช้บัญชี Google อีกใบที่ email เดียวกัน)
      // การ insert ตรงๆ จะชน constraint แล้วเด้ง 500 ตอน login
      // กรณีนี้ถือว่าเป็นคนเดิม (email ยืนยันแล้วตรงกัน) จึงอัปเดต account id ให้แทน
      await tx
        .insert(userIdentitiesTable)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        })
        .onConflictDoUpdate({
          target: [userIdentitiesTable.userId, userIdentitiesTable.provider],
          set: { providerAccountId: profile.providerAccountId },
        });

      return user;
    });
  },

  /** สร้าง session ใหม่ คืน token ที่จะเอาไปใส่คุกกี้ */
  async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

    await dbClient
      .insert(sessionsTable)
      .values({ id: token, userId, expiresAt });

    return { token, expiresAt };
  },

  /** คืนผู้ใช้ของ session ที่ยังไม่หมดอายุ — ไม่เจอ/หมดอายุ = undefined */
  async findUserBySession(token: string): Promise<AuthUser | undefined> {
    const rows = await dbClient
      .select(userColumns)
      .from(sessionsTable)
      .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
      .where(
        and(
          eq(sessionsTable.id, token),
          sql`${sessionsTable.expiresAt} > now()`,
        ),
      )
      .limit(1);

    return firstOrUndefined(rows);
  },

  async deleteSession(token: string): Promise<void> {
    await dbClient.delete(sessionsTable).where(eq(sessionsTable.id, token));
  },

  /** ลบ session ที่หมดอายุแล้วทิ้ง (เรียกเป็นระยะ) */
  async deleteExpiredSessions(): Promise<number> {
    const deleted = await dbClient
      .delete(sessionsTable)
      .where(lt(sessionsTable.expiresAt, new Date()))
      .returning({ id: sessionsTable.id });

    return deleted.length;
  },
};

export default authModel;
