ALTER TYPE "public"."log_action" ADD VALUE 'borrow_picked_up';--> statement-breakpoint
CREATE TABLE "departments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "staff_departments" (
	"user_id" varchar(64) NOT NULL,
	"department_id" bigint NOT NULL,
	CONSTRAINT "staff_departments_user_id_department_id_pk" PRIMARY KEY("user_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "picked_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "picked_up_by" varchar(64);--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "department_id" bigint;--> statement-breakpoint
ALTER TABLE "staff_departments" ADD CONSTRAINT "staff_departments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_departments" ADD CONSTRAINT "staff_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrows" ADD CONSTRAINT "borrows_picked_up_by_users_id_fk" FOREIGN KEY ("picked_up_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_borrows_period" ON "borrows" USING btree ("start_at","end_at");--> statement-breakpoint
ALTER TABLE "borrows" ADD CONSTRAINT "borrows_period_valid" CHECK (("borrows"."start_at" IS NULL AND "borrows"."end_at" IS NULL) OR "borrows"."end_at" > "borrows"."start_at");--> statement-breakpoint
-- ย้ายข้อมูลจากตาราง ws_* ที่ backend เคยสร้างเองตอนรัน (services/featureStore.js) แล้วลบทิ้ง
DO $$
BEGIN
	IF to_regclass('public.ws_departments') IS NOT NULL THEN
		INSERT INTO "departments" ("id", "name", "created_at")
			SELECT "id", "name", "created_at" FROM "ws_departments";
		PERFORM setval(pg_get_serial_sequence('departments', 'id'), GREATEST((SELECT MAX("id") FROM "departments"), 1));
	END IF;
	IF to_regclass('public.ws_equipment_departments') IS NOT NULL THEN
		UPDATE "equipment" e SET "department_id" = m."department_id"
			FROM "ws_equipment_departments" m WHERE m."equipment_id" = e."id";
	END IF;
	IF to_regclass('public.ws_staff_departments') IS NOT NULL THEN
		INSERT INTO "staff_departments" ("user_id", "department_id")
			SELECT "user_id", "department_id" FROM "ws_staff_departments";
	END IF;
	IF to_regclass('public.ws_borrow_details') IS NOT NULL THEN
		UPDATE "borrows" b SET "start_at" = d."start_at", "end_at" = d."end_at",
			"picked_up_at" = d."picked_up_at", "picked_up_by" = d."picked_up_by"
			FROM "ws_borrow_details" d WHERE d."borrow_id" = b."id";
	END IF;
	DROP TABLE IF EXISTS "ws_borrow_details", "ws_staff_departments", "ws_equipment_departments", "ws_departments";
END $$;
