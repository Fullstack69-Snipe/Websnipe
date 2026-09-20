// รัน migration ที่ drizzle-kit generate สร้างไว้ใน db/migration
//   pnpm db:generate   -> สร้างไฟล์ .sql จาก schema.ts
//   pnpm db:migrate    -> รันไฟล์เหล่านั้นใส่ฐานข้อมูลจริง (ไฟล์นี้)

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { connectionString } from "@db/utils.js";

// migration ต้องรันทีละคำสั่งตามลำดับ จึงใช้คอนเนกชันเดียว (max: 1)
const migrationConn = postgres(connectionString, { max: 1 });

async function main() {
  await migrate(drizzle(migrationConn), { migrationsFolder: "./db/migration" });
  console.log("migrate สำเร็จ");
}

main()
  .catch((error) => {
    console.error("migrate ล้มเหลว:", error);
    process.exitCode = 1;
  })
  .finally(() => migrationConn.end());
