// package.json ของ db ประกาศ "type": "module" ซึ่งมีผลกับไฟล์ .js ทุกไฟล์ใต้โฟลเดอร์
// รวมถึงผลลัพธ์ CommonJS ใน dist/cjs ด้วย — Node จะอ่านเป็น ESM แล้วพังทันที
//
// วิธีมาตรฐานคือหย่อน package.json อีกไฟล์ไว้ในโฟลเดอร์ output
// เพื่อ override ค่า type เฉพาะใต้โฟลเดอร์นั้น

import { mkdir, writeFile } from "node:fs/promises";

const OUT_DIR = new URL("../dist/cjs/", import.meta.url);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  new URL("package.json", OUT_DIR),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
);

console.log("เขียน dist/cjs/package.json (type: commonjs) แล้ว");
