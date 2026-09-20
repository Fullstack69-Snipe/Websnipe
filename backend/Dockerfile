# backend/Dockerfile
# build context = root ของ repo (ดู docker-compose.yml) เพราะ backend พึ่งพาแพ็กเกจ db
# แบบ file:../db จึงต้องมีทั้งสองโฟลเดอร์อยู่ใน context
#
# ไม่ต้องมี python/make/g++ แล้ว เพราะเลิกใช้ better-sqlite3 (native module)
# ไปใช้ postgres ที่เป็น pure JS แทน

FROM node:22-bookworm-slim

WORKDIR /app

# ---------- 1) build แพ็กเกจ db (TypeScript -> dist/) ----------
COPY db/package.json db/tsconfig.json db/tsconfig.cjs.json ./db/
COPY db/scripts ./db/scripts
RUN cd db && npm install --no-audit --no-fund

COPY db/db ./db/db
COPY db/drizzle.config.ts ./db/
RUN cd db && npm run build

# ---------- 2) ติดตั้ง dependency ของ backend ----------
COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev --no-audit --no-fund

# ---------- 3) โค้ด backend ----------
COPY backend/src ./backend/src
COPY backend/db ./backend/db
COPY backend/docker-entrypoint.sh ./backend/

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads

RUN mkdir -p /data/uploads && chmod +x /app/backend/docker-entrypoint.sh

EXPOSE 3000

# entrypoint รอ db พร้อม -> รัน migration (+ seed) -> ค่อยสตาร์ต express
ENTRYPOINT ["/app/backend/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
