ALTER TYPE "public"."borrow_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."log_action" ADD VALUE 'borrow_cancelled';