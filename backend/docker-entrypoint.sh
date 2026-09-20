#!/bin/sh
# รัน migration (และ seed ครั้งแรก) ก่อนสตาร์ต express
#
# compose รอให้ postgres healthy อยู่แล้ว แต่ healthy = รับคอนเนกชันได้
# ยังไม่ได้แปลว่าตารางถูกสร้าง จึงต้องรัน migrate ตรงนี้ทุกครั้งที่บูต
# (drizzle ข้าม migration ที่รันไปแล้วเอง)
set -e

cd /app/db

echo "[entrypoint] running migrations..."
node dist/db/migrate.js

if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] seeding (ข้ามเองถ้ามีข้อมูลแล้ว)..."
  node dist/db/seed.js
fi

cd /app/backend
echo "[entrypoint] starting backend..."
exec "$@"
