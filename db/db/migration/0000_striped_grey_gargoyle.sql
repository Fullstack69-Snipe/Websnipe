CREATE TYPE "public"."borrow_status" AS ENUM('pending', 'approved', 'rejected', 'returning', 'returned');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'staff', 'admin');--> statement-breakpoint
CREATE TABLE "borrows" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"equipment_id" varchar(64) NOT NULL,
	"borrower_id" varchar(64) NOT NULL,
	"due_date" date NOT NULL,
	"status" "borrow_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone,
	CONSTRAINT "borrows_returned_at_matches_status" CHECK (("borrows"."status" = 'returned') = ("borrows"."returned_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_quantity_non_negative" CHECK ("equipment"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "borrows" ADD CONSTRAINT "borrows_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrows" ADD CONSTRAINT "borrows_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_borrows_equipment" ON "borrows" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "idx_borrows_borrower" ON "borrows" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_borrows_status" ON "borrows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_borrows_created_at" ON "borrows" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_equipment_created_at" ON "equipment" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");