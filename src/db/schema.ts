import { pgTable, uuid, text, timestamp, boolean, bigint, vector, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  pgPolicy("view_own_wardrobe_items", {
    for: "select",
    to: "authenticated",
    using: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
  pgPolicy("insert_own_wardrobe_items", {
    for: "insert",
    to: "authenticated",
    withCheck: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
  pgPolicy("update_own_wardrobe_items", {
    for: "update",
    to: "authenticated",
    using: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
    withCheck: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
  pgPolicy("delete_own_wardrobe_items", {
    for: "delete",
    to: "authenticated",
    using: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
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
  pgPolicy("view_own_profile", {
    for: "select",
    to: "authenticated",
    using: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
  pgPolicy("insert_own_profile", {
    for: "insert",
    to: "authenticated",
    withCheck: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
  pgPolicy("update_own_profile", {
    for: "update",
    to: "authenticated",
    using: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
    withCheck: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
]);

// Definition for subscriptions table to support RLS
export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status"),
  priceId: text("price_id"),
  quantity: bigint("quantity", { mode: "number" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end"),
  created: timestamp("created", { withTimezone: true }).defaultNow().notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  cancelAt: timestamp("cancel_at", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  trialStart: timestamp("trial_start", { withTimezone: true }),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
}, (table) => [
  pgPolicy("view_own_subscription", {
    for: "select",
    to: "authenticated",
    using: sql`user_id = current_setting('request.jwt.claim.sub', true)`,
  }),
]);
