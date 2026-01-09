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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").unique().notNull().references(() => stripeCustomers.userId),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: text("status").notNull().default("none"),
  priceId: text("price_id"),
  currentPeriodStart: bigint("current_period_start", { mode: "number" }),
  currentPeriodEnd: bigint("current_period_end", { mode: "number" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
