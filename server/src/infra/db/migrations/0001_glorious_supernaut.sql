DROP INDEX "links_created_at_id_idx";--> statement-breakpoint
CREATE INDEX "links_created_at_id_idx" ON "links" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);