import { pgTable, uuid, text, timestamp, boolean, bigint, vector } from "drizzle-orm/pg-core";

export const wardrobeItems = pgTable("wardrobe_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  category: text("category"),
  description: text("description"),
  styleTags: text("style_tags").array(),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stripeCustomers = pgTable("stripe_customers", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  bio: text("bio"),
  zepSynced: boolean("zep_synced").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

