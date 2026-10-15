// ใส่ข้อมูลตั้งต้นชุดเดียวกับฝั่ง backend/frontend mock
// รันซ้ำได้ (ข้ามถ้ามีข้อมูลแล้ว) หรือใช้ --reset เพื่อล้างก่อน
//   pnpm db:seed
//   pnpm db:seed --reset
//
// ตั้งใจให้มีของครบทุกสถานะ (รออนุมัติ / รอรับของ / กำลังยืม / แจ้งคืน / เกินกำหนด /
// คืนแล้ว / ถูกปฏิเสธ / ยกเลิก) เปิดระบบครั้งแรกจะได้เห็นทุกหน้าจอมีข้อมูลจริง
// id ของ users / equipment / b1-b3 ถูกอ้างใน backend/db/smoke-test.js — แก้แล้วต้องแก้เทสต์ด้วย
//
// รูปอยู่ที่ frontend/public/seed/ (เครดิตใน CREDITS.md ในโฟลเดอร์เดียวกัน)

import { sql } from "drizzle-orm";
import { dbClient, dbConn } from "@db/client.js";
import {
  borrowsTable,
  categoriesTable,
  departmentsTable,
  equipmentLogsTable,
  equipmentTable,
  staffDepartmentsTable,
  usersTable,
  type BorrowStatus,
  type NewBorrow,
  type NewEquipment,
  type NewEquipmentLog,
  type NewUser,
} from "@db/schema.js";

const RESET = process.argv.includes("--reset");

// ---------- วันที่แบบสัมพันธ์กับวันนี้ (ตามเวลาไทย) ----------
const bangkokDate = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
/** วันที่ offsetDays จากวันนี้ เวลา hh:mm ตามเวลาไทย */
const at = (offsetDays: number, time = "09:00") =>
  new Date(`${bangkokDate(offsetDays)}T${time}:00+07:00`);

const users: NewUser[] = [
  { id: "u1", email: "somchai@example.com", fullName: "สมชาย ใจดี", role: "user" },
  { id: "u2", email: "somying@example.com", fullName: "สมหญิง รักงาน", role: "staff" },
  { id: "u3", email: "admin@example.com", fullName: "ผู้ดูแล ระบบ", role: "admin" },
  { id: "u4", email: "wichai@example.com", fullName: "วิชัย มั่นคง", role: "user" },
  { id: "u5", email: "prasert@example.com", fullName: "ประเสริฐ ช่างคอม", role: "staff" },
];
const nameOf = (id: string) => users.find((u) => u.id === id)!.fullName;

// หมวดหมู่ตั้งต้น — id เป็น bigserial จึงไล่จาก 1 ตามลำดับที่ insert (--reset เริ่มนับใหม่ด้วย)
const categories = [
  { name: "กล้องและถ่ายภาพ", description: "กล้อง ขาตั้ง แฟลช" },
  { name: "คอมพิวเตอร์", description: "โน้ตบุ๊ก แท็บเล็ต" },
  { name: "เสียง", description: "ไมค์ ลำโพง" },
  { name: "จอและการนำเสนอ", description: "โปรเจกเตอร์ จอ" },
];

// แผนก — สมหญิงดูแลทั้งสองแผนก ประเสริฐดูแลแค่ห้องคอม (เห็นความต่างของสิทธิ์ได้)
const departments = [
  { key: "av", name: "ห้องสื่อโสตทัศนูปกรณ์", staff: ["u2"] },
  { key: "lab", name: "ห้องปฏิบัติการคอมพิวเตอร์", staff: ["u2", "u5"] },
] as const;

const equipment: (NewEquipment & { department: "av" | "lab" })[] = [
  { id: "e1", name: "กล้อง Canon EOS R50", description: "กล้องมิเรอร์เลส 24MP พร้อมเลนส์ RF-S 18-45mm และแบตสำรอง 1 ก้อน", imageUrl: "/seed/canon-eos-r50.jpg", quantity: 2, categoryId: 1, department: "av" },
  { id: "e2", name: "โน้ตบุ๊ก Dell Latitude 7490", description: "Core i5 / RAM 16GB / SSD 512GB พร้อมสายชาร์จและเมาส์", imageUrl: "/seed/dell-latitude-7490.jpg", quantity: 3, categoryId: 2, department: "lab" },
  { id: "e3", name: "ขาตั้งกล้อง Manfrotto 190XB", description: "สูงสุด 146 cm พร้อมหัวบอลและกระเป๋า", imageUrl: "/seed/manfrotto-190xb.jpg", quantity: 4, categoryId: 1, department: "av" },
  { id: "e4", name: "ไมค์ไร้สาย Rode Wireless GO II", description: "ตัวส่ง 2 ตัว + ตัวรับ 1 ตัว พร้อมขนกันลม", imageUrl: "/seed/rode-wireless-go-ii.jpg", quantity: 2, categoryId: 3, department: "av" },
  { id: "e5", name: "โปรเจกเตอร์ Epson EB-U04", description: "3,000 lumens ความละเอียด WUXGA พร้อมสาย HDMI 5 เมตร", imageUrl: "/seed/epson-eb-u04.jpg", quantity: 1, categoryId: 4, department: "lab" },
  { id: "e6", name: "แฟลช Godox TT685 II", description: "แฟลชหัวกล้อง TTL สำหรับกล้อง Sony พร้อมถ่านชาร์จ 4 ก้อน", imageUrl: "/seed/godox-tt685ii.jpg", quantity: 6, categoryId: 1, department: "av" },
];

// ---------- รายการยืม: ครบทุกสถานะ ----------
type Seed = {
  id: string;
  equipmentId: string;
  borrowerId: string;
  status: BorrowStatus;
  start: Date;
  end: Date;
  purpose: string;
  requestedAt: Date;
  approvedAt?: Date;      // อนุมัติหรือปฏิเสธ
  rejectReason?: string;
  cancelledAt?: Date;
  pickedUpAt?: Date;
  returnRequestedAt?: Date;
  returnedAt?: Date;
  returnNote?: string;
};

const STAFF = "u2";

const seeds: Seed[] = [
  // b1-b3 ถูกอ้างในเทสต์ — b1 กำลังยืม / b2 เกินกำหนด / b3 คืนแล้ว
  { id: "b1", equipmentId: "e2", borrowerId: "u4", status: "approved", start: at(-2, "00:00"), end: at(5, "23:59"),
    purpose: "ทำรายงานกลุ่มวิชาสถิติ", requestedAt: at(-3, "14:10"), approvedAt: at(-3, "16:30"), pickedUpAt: at(-2, "09:15") },
  { id: "b2", equipmentId: "e5", borrowerId: "u1", status: "approved", start: at(-9, "00:00"), end: at(-1, "23:59"),
    purpose: "นำเสนอโครงงานจบต่อกรรมการ", requestedAt: at(-11, "10:00"), approvedAt: at(-10, "09:05"), pickedUpAt: at(-9, "08:40") },
  { id: "b3", equipmentId: "e1", borrowerId: "u1", status: "returned", start: at(-30, "00:00"), end: at(-20, "23:59"),
    purpose: "ถ่ายภาพงานรับปริญญาของคณะ", requestedAt: at(-32, "11:20"), approvedAt: at(-31, "13:00"), pickedUpAt: at(-30, "09:00"),
    returnRequestedAt: at(-21, "16:00"), returnedAt: at(-21, "16:45"), returnNote: "สภาพปกติ ครบถ้วน" },
  // รออนุมัติ
  { id: "b4", equipmentId: "e1", borrowerId: "u4", status: "pending", start: at(1, "00:00"), end: at(4, "23:59"),
    purpose: "ถ่ายภาพกิจกรรมกีฬาสีคณะ", requestedAt: at(0, "08:30") },
  // อนุมัติแล้ว รอมารับของ
  { id: "b5", equipmentId: "e3", borrowerId: "u1", status: "approved", start: at(0, "00:00"), end: at(3, "23:59"),
    purpose: "ถ่ายวิดีโอสัมภาษณ์อาจารย์", requestedAt: at(-1, "15:00"), approvedAt: at(-1, "17:20") },
  // แจ้งคืนแล้ว รอเจ้าหน้าที่ตรวจรับ
  { id: "b6", equipmentId: "e6", borrowerId: "u4", status: "returning", start: at(-3, "00:00"), end: at(1, "23:59"),
    purpose: "ถ่ายภาพสินค้าโปรเจกต์ธุรกิจ", requestedAt: at(-5, "13:00"), approvedAt: at(-4, "10:00"), pickedUpAt: at(-3, "09:30"),
    returnRequestedAt: at(0, "08:00") },
  // ถูกปฏิเสธ พร้อมเหตุผล
  { id: "b7", equipmentId: "e4", borrowerId: "u1", status: "rejected", start: at(2, "00:00"), end: at(3, "23:59"),
    purpose: "อัดพอดแคสต์ชมรม", requestedAt: at(-1, "19:00"),
    approvedAt: at(0, "09:10"), rejectReason: "ช่วงนั้นไมค์ถูกจองใช้ในงานสัมมนาของคณะแล้ว" },
  // ผู้ยืมยกเลิกเอง
  { id: "b8", equipmentId: "e2", borrowerId: "u1", status: "cancelled", start: at(7, "00:00"), end: at(9, "23:59"),
    purpose: "ติวสอบกลางภาค", requestedAt: at(-2, "20:00"), cancelledAt: at(-1, "08:00") },
];

const toBorrow = (s: Seed): NewBorrow => ({
  id: s.id,
  equipmentId: s.equipmentId,
  borrowerId: s.borrowerId,
  dueDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(s.end),
  status: s.status,
  purpose: s.purpose,
  startAt: s.start,
  endAt: s.end,
  createdAt: s.requestedAt,
  approvedBy: s.approvedAt ? STAFF : null,
  approvedAt: s.approvedAt ?? null,
  rejectReason: s.rejectReason ?? null,
  pickedUpAt: s.pickedUpAt ?? null,
  pickedUpBy: s.pickedUpAt ? STAFF : null,
  receivedBy: s.returnedAt ? STAFF : null,
  returnNote: s.returnNote ?? null,
  returnedAt: s.returnedAt ?? null,
});

// ประวัติของแต่ละรายการ เรียงตามลำดับที่เกิดจริง ให้หน้าประวัติอุปกรณ์มีข้อมูลตรงกับสถานะ
function logsOf(s: Seed): NewEquipmentLog[] {
  const item = equipment.find((e) => e.id === s.equipmentId)!;
  const log = (
    action: NewEquipmentLog["action"],
    actorId: string,
    createdAt: Date,
    fromStatus: BorrowStatus | null,
    toStatus: BorrowStatus | null,
    note: string | null = null,
  ): NewEquipmentLog => ({
    equipmentId: item.id,
    equipmentName: item.name,
    borrowId: s.id,
    actorId,
    actorName: nameOf(actorId),
    action,
    fromStatus,
    toStatus,
    note,
    createdAt,
  });

  const out = [log("borrow_requested", s.borrowerId, s.requestedAt, null, "pending", s.purpose)];
  if (s.rejectReason) out.push(log("borrow_rejected", STAFF, s.approvedAt!, "pending", "rejected", s.rejectReason));
  else if (s.approvedAt) out.push(log("borrow_approved", STAFF, s.approvedAt, "pending", "approved"));
  if (s.cancelledAt) out.push(log("borrow_cancelled", s.borrowerId, s.cancelledAt, "pending", "cancelled"));
  if (s.pickedUpAt) out.push(log("borrow_picked_up", STAFF, s.pickedUpAt, null, null));
  if (s.returnRequestedAt) out.push(log("borrow_return_requested", s.borrowerId, s.returnRequestedAt, "approved", "returning"));
  if (s.returnedAt) out.push(log("borrow_returned", STAFF, s.returnedAt, "returning", "returned", s.returnNote));
  return out;
}

async function main() {
  await dbClient.transaction(async (tx) => {
    if (RESET) {
      // ล้างทุกตารางในคำสั่งเดียว — RESTART IDENTITY ให้ id ของหมวดหมู่/แผนกเริ่มนับจาก 1 ใหม่
      await tx.execute(sql`
        TRUNCATE equipment_logs, borrows, staff_departments, equipment, departments,
                 categories, sessions, user_identities, users
        RESTART IDENTITY CASCADE
      `);
      console.log("ล้างข้อมูลเดิมแล้ว");
    }

    const existing = await tx.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) {
      console.log("มีข้อมูลอยู่แล้ว ข้ามการ seed (ใช้ --reset ถ้าต้องการล้างแล้วใส่ใหม่)");
      return;
    }

    await tx.insert(usersTable).values(users);
    await tx.insert(categoriesTable).values(categories);

    const departmentId: Record<string, number> = {};
    for (const d of departments) {
      const [row] = await tx.insert(departmentsTable).values({ name: d.name }).returning();
      departmentId[d.key] = row!.id;
      await tx
        .insert(staffDepartmentsTable)
        .values(d.staff.map((userId) => ({ userId, departmentId: row!.id })));
    }

    await tx.insert(equipmentTable).values(
      equipment.map(({ department, ...e }) => ({ ...e, departmentId: departmentId[department] })),
    );
    await tx.insert(equipmentLogsTable).values(
      equipment.map((e) => ({
        equipmentId: e.id!,
        equipmentName: e.name,
        actorId: "u3",
        actorName: nameOf("u3"),
        action: "equipment_created" as const,
        note: `จำนวน ${e.quantity} ชิ้น`,
        createdAt: at(-60),
      })),
    );
    await tx.insert(borrowsTable).values(seeds.map(toBorrow));
    await tx.insert(equipmentLogsTable).values(seeds.flatMap(logsOf));

    console.log(
      `seed สำเร็จ: users ${users.length} / departments ${departments.length} / categories ${categories.length} / equipment ${equipment.length} / borrows ${seeds.length}`,
    );
  });
}

main()
  .catch((error) => {
    console.error("seed ล้มเหลว:", error);
    process.exitCode = 1;
  })
  .finally(() => dbConn.end());
