# backend/Dockerfile
FROM node:22-bookworm-slim

# better-sqlite3 เป็น native module — ต้องมี toolchain ตอน npm ci
# ติดตั้งแล้วถอนออกใน layer เดียวกันเพื่อไม่ให้ image บวม
WORKDIR /app

COPY package*.json ./

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci --omit=dev \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

COPY . .

# เก็บ DB กับรูปไว้ใน volume (ดู docker-compose)
ENV NODE_ENV=production \
    PORT=3000 \
    DB_FILE=/data/data.sqlite \
    UPLOAD_DIR=/data/uploads

RUN mkdir -p /data/uploads

EXPOSE 3000

CMD ["node", "src/server.js"]
