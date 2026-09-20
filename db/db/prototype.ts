import { desc, eq, inArray, sql } from "drizzle-orm";
import { dbClient, dbConn } from "@db/client.js";
import {
  HOLDING_STATUSES,
  borrowsTable,
  equipmentTable,
  usersTable,
} from "@db/schema.js";

// รายการอุปกรณ์พร้อม available (quantity - จำนวนที่ถือของอยู่)
// เทียบเท่า SELECT_WITH_AVAILABLE ใน backend/src/models/equipmentModel.js
async function listEquipment() {
  const results = await dbClient
    .select({
      id: equipmentTable.id,
      name: equipmentTable.name,
      description: equipmentTable.description,
      imageUrl: equipmentTable.imageUrl,
      quantity: equipmentTable.quantity,
      available: sql<number>`${equipmentTable.quantity} - (
        SELECT COUNT(*) FROM ${borrowsTable}
        WHERE ${borrowsTable.equipmentId} = ${equipmentTable.id}
          AND ${inArray(borrowsTable.status, [...HOLDING_STATUSES])}
      )`.mapWith(Number),
    })
    .from(equipmentTable)
    .orderBy(equipmentTable.createdAt);

  console.log(results);
}

// รายการยืมพร้อมชื่ออุปกรณ์/ชื่อผู้ยืม ใหม่สุดขึ้นก่อน
async function listBorrows() {
  const results = await dbClient.query.borrowsTable.findMany({
    with: {
      equipment: { columns: { name: true } },
      borrower: { columns: { fullName: true } },
    },
    orderBy: desc(borrowsTable.createdAt),
  });

  console.log(results);
}

async function listPendingByBorrower(borrowerId: string) {
  const results = await dbClient
    .select()
    .from(borrowsTable)
    .where(eq(borrowsTable.borrowerId, borrowerId));

  console.log(results);
}

async function listStaff() {
  const results = await dbClient
    .select()
    .from(usersTable)
    .where(inArray(usersTable.role, ["staff", "admin"]));

  console.log(results);
}

async function main() {
  await listEquipment();
  // await listBorrows();
  // await listPendingByBorrower("u1");
  // await listStaff();
  await dbConn.end();
}

main();
