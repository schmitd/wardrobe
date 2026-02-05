import { pgTable, uuid, text, timestamp, boolean, bigint, vector, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const authenticated = "authenticated";
const isOwner = sql`user_id = current_setting('request.jwt.claim.sub', true)`;

export const wardrobeItems = pgTable("wardrobe_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  category: text("category"),
  description: text("description"),
  styleTags: text("style_tags").array(),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("view_own_wardrobe", { for: "select", to: authenticated, using: isOwner }),
  pgPolicy("insert_own_wardrobe", { for: "insert", to: authenticated, withCheck: isOwner }),
  pgPolicy("update_own_wardrobe", { for: "update", to: authenticated, using: isOwner }),
  pgPolicy("delete_own_wardrobe", { for: "delete", to: authenticated, using: isOwner }),
]);

export const stripeCustomers = pgTable("stripe_customers", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  bio: text("bio"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("view_own_profile", { for: "select", to: authenticated, using: isOwner }),
  pgPolicy("insert_own_profile", { for: "insert", to: authenticated, withCheck: isOwner }),
  pgPolicy("update_own_profile", { for: "update", to: authenticated, using: isOwner }),
]);

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status"),
}, (table) => [
  pgPolicy("view_own_subscription", { for: "select", to: authenticated, using: isOwner }),
]);
