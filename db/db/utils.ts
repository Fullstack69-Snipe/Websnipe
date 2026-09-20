import "dotenv/config";

const dbUser = process.env.POSTGRES_APP_USER;
const dbPassword = process.env.POSTGRES_APP_PASSWORD;
const dbHost = process.env.POSTGRES_HOST;
const dbPort = process.env.POSTGRES_PORT;
const dbName = process.env.POSTGRES_DB;

// console.log({
//   dbUser,
//   dbPassword,
//   dbHost,
//   dbPort,
//   dbName,
// });

const missing = Object.entries({
  POSTGRES_APP_USER: dbUser,
  POSTGRES_APP_PASSWORD: dbPassword,
  POSTGRES_HOST: dbHost,
  POSTGRES_PORT: dbPort,
  POSTGRES_DB: dbName,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Invalid DB env. ตัวแปรที่ยังไม่ได้ตั้งค่า: ${missing.join(", ")} (ดูตัวอย่างใน .env.example)`,
  );
}

// encode เผื่อรหัสผ่านมีอักขระพิเศษ (@ : / ?) ที่จะทำให้ URL เพี้ยน
export const connectionString = `postgres://${encodeURIComponent(dbUser!)}:${encodeURIComponent(dbPassword!)}@${dbHost}:${dbPort}/${dbName}`;
