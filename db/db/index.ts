// จุดเข้าเดียวของแพ็กเกจ db — ฝั่ง backend import จากไฟล์นี้ไฟล์เดียวพอ
//
//   const { equipmentModel, borrowModel, userModel } = require('db');
//
// ชื่อฟังก์ชันและหน้าตาข้อมูลที่คืนกลับ เหมือน backend/src/models/*.js เดิมทุกอย่าง
// ต่างกันแค่ทุกฟังก์ชันเป็น async จึงต้องเติม await ตอนเรียก

export { dbClient, dbConn } from "@db/client.js";
export { connectionString } from "@db/utils.js";

export {
  borrowsTable,
  categoriesTable,
  equipmentTable,
  equipmentLogsTable,
  sessionsTable,
  userIdentitiesTable,
  usersTable,
  authProviderEnum,
  borrowStatusEnum,
  roleEnum,
  HOLDING_STATUSES,
  type Borrow,
  type BorrowStatus,
  type Equipment,
  type NewBorrow,
  type NewEquipment,
  type NewUser,
  type Role,
  type Session,
  type User,
  type UserIdentity,
  type AuthProvider,
  type Category,
  type EquipmentLog,
  type LogAction,
} from "@db/schema.js";

export {
  borrowModel,
  type Actor,
  type BorrowRow,
} from "@db/models/borrowModel.js";
export { logModel, type LogRow, type LogInput } from "@db/models/logModel.js";
export {
  categoryModel,
  type CategoryRow,
  type CategoryInput,
} from "@db/models/categoryModel.js";
export {
  equipmentModel,
  HOLDING,
  type EquipmentInput,
  type EquipmentRow,
} from "@db/models/equipmentModel.js";
export { userModel, type UserRow } from "@db/models/userModel.js";
export {
  authModel,
  type AuthUser,
  type OAuthProfile,
} from "@db/models/authModel.js";
