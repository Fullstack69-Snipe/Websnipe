// ใส่ข้อมูลตั้งต้นชุดเดียวกับฝั่ง backend/frontend mock
// รันซ้ำได้ (ข้ามถ้ามีข้อมูลแล้ว) หรือใช้ --reset เพื่อล้างก่อน
//   pnpm db:seed
//   pnpm db:seed --reset

import { dbClient, dbConn } from "@db/client.js";
import {
  borrowsTable,
  categoriesTable,
  equipmentTable,
  usersTable,
  type NewBorrow,
  type NewEquipment,
  type NewUser,
} from "@db/schema.js";

const RESET = process.argv.includes("--reset");

// ---------- วันที่แบบสัมพันธ์กับวันนี้ ----------
const DAY_MS = 86_400_000;
const shift = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS);
const dateOnly = (offsetDays: number) =>
  shift(offsetDays).toISOString().slice(0, 10);

const users: NewUser[] = [
  { id: "u1", email: "somchai@example.com", fullName: "สมชาย ใจดี", role: "user" },
  { id: "u2", email: "somying@example.com", fullName: "สมหญิง รักงาน", role: "staff" },
  { id: "u3", email: "admin@example.com", fullName: "ผู้ดูแล ระบบ", role: "admin" },
  { id: "u4", email: "wichai@example.com", fullName: "วิชัย มั่นคง", role: "user" },
];

// หมวดหมู่ตั้งต้น — id เป็น bigserial จึงไล่จาก 1 ตามลำดับที่ insert
const categories = [
  { name: "กล้องและถ่ายภาพ", description: "กล้อง เลนส์ ขาตั้ง" },
  { name: "คอมพิวเตอร์", description: "โน้ตบุ๊ก แท็บเล็ต" },
  { name: "เสียงและแสง", description: "ไมค์ ไฟ ลำโพง" },
  { name: "จอและการนำเสนอ", description: "โปรเจกเตอร์ จอ" },
];

const equipment: NewEquipment[] = [
  { id: "e1", name: "กล้อง Canon EOS R50", description: "พร้อมเลนส์คิท 18-45mm", imageUrl: "https://picsum.photos/seed/camera/400/240", quantity: 2, categoryId: 1 },
  { id: "e2", name: "โน้ตบุ๊ก Dell Latitude 5450", description: "i5 / RAM 16GB / SSD 512GB", imageUrl: "https://picsum.photos/seed/laptop/400/240", quantity: 3, categoryId: 2 },
  { id: "e3", name: "ขาตั้งกล้อง Manfrotto", description: "สูงสุด 160 cm พร้อมกระเป๋า", imageUrl: "https://picsum.photos/seed/tripod/400/240", quantity: 4, categoryId: 1 },
  { id: "e4", name: "ไมค์ Rode Wireless GO II", description: "ไมค์ไร้สาย 2 ตัว", imageUrl: null, quantity: 1, categoryId: 3 },
  { id: "e5", name: "โปรเจกเตอร์ Epson EB-X06", description: "3600 lumens พร้อมสาย HDMI", imageUrl: "https://picsum.photos/seed/projector/400/240", quantity: 1, categoryId: 4 },
  { id: "e6", name: "ไฟ LED Godox SL60", description: "พร้อมซอฟต์บ็อกซ์", imageUrl: "https://picsum.photos/seed/light/400/240", quantity: 6, categoryId: 3 },
];

const borrows: NewBorrow[] = [
  // กำลังยืม ปกติ
  { id: "b1", equipmentId: "e2", borrowerId: "u4", dueDate: dateOnly(5), status: "approved", createdAt: shift(-2), returnedAt: null },
  // เกินกำหนดแล้ว — ใช้ทดสอบการไฮไลต์สีแดง
  { id: "b2", equipmentId: "e5", borrowerId: "u1", dueDate: dateOnly(-1), status: "approved", createdAt: shift(-9), returnedAt: null },
  // ประวัติที่คืนแล้ว
  { id: "b3", equipmentId: "e1", borrowerId: "u1", dueDate: dateOnly(-20), status: "returned", createdAt: shift(-30), returnedAt: shift(-21) },
];

async function main() {
  await dbClient.transaction(async (tx) => {
    if (RESET) {
      // ลบตามลำดับ FK: borrows อ้างถึง equipment และ users
      await tx.delete(borrowsTable);
      await tx.delete(equipmentTable);
      await tx.delete(categoriesTable);
      await tx.delete(usersTable);
      console.log("ล้างข้อมูลเดิมแล้ว");
    }

    const existing = await tx.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) {
      console.log("มีข้อมูลอยู่แล้ว ข้ามการ seed (ใช้ --reset ถ้าต้องการล้างแล้วใส่ใหม่)");
      return;
    }

    await tx.insert(usersTable).values(users);
    await tx.insert(categoriesTable).values(categories);
    await tx.insert(equipmentTable).values(equipment);
    await tx.insert(borrowsTable).values(borrows);

    console.log(
      `seed สำเร็จ: users ${users.length} / categories ${categories.length} / equipment ${equipment.length} / borrows ${borrows.length}`,
    );
  });
}

main()
  .catch((error) => {
    console.error("seed ล้มเหลว:", error);
    process.exitCode = 1;
  })
  .finally(() => dbConn.end());
