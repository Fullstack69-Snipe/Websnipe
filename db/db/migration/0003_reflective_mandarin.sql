CREATE TYPE "public"."log_action" AS ENUM('equipment_created', 'equipment_updated', 'equipment_deleted', 'borrow_requested', 'borrow_approved', 'borrow_rejected', 'borrow_return_requested', 'borrow_returned');--> statement-breakpoint
CREATE TABLE "equipment_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"equipment_id" varchar(64),
	"equipment_name" varchar(255) NOT NULL,
	"borrow_id" varchar(64),
	"actor_id" varchar(64),
	"actor_name" varchar(255) NOT NULL,
	"action" "log_action" NOT NULL,
	"from_status" "borrow_status",
	"to_status" "borrow_status",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "approved_by" varchar(64);--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "received_by" varchar(64);--> statement-breakpoint
ALTER TABLE "borrows" ADD COLUMN "return_note" text;--> statement-breakpoint
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_borrow_id_borrows_id_fk" FOREIGN KEY ("borrow_id") REFERENCES "public"."borrows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_log_equipment" ON "equipment_logs" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "idx_log_created_at" ON "equipment_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_log_borrow" ON "equipment_logs" USING btree ("borrow_id");--> statement-breakpoint
ALTER TABLE "borrows" ADD CONSTRAINT "borrows_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrows" ADD CONSTRAINT "borrows_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;