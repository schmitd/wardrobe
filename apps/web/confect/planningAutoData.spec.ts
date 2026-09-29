import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
import { Id } from "./_generated/id";
import RequireUser from "./middleware/RequireUser.spec";
import { InvalidPlanningInput } from "./errors";

export const jobArgs = { userId: Schema.String, revision: Schema.Number };
const itemId = Id("wardrobeItems");
export const autoOutfit = Schema.Struct({
  date: Schema.String,
  title: Schema.String,
  rationale: Schema.String,
  context: Schema.Array(Schema.String),
  itemIds: Schema.Array(itemId),
  missing: Schema.Array(Schema.String),
});
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "configure",
      args: () => ({
        timezone: Schema.String,
        enabled: Schema.optional(Schema.Boolean),
        retry: Schema.optional(Schema.Boolean),
      }),
      returns: () => Schema.Null,
      error: () => InvalidPlanningInput,
    }).middleware(RequireUser),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claim",
      args: () => jobArgs,
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            timezone: Schema.String,
            calendarEnabled: Schema.Boolean,
            calendarIds: Schema.Array(Schema.String),
            calendarRevision: Schema.Number,
          }),
        ),
    }),
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "load",
      args: () => ({
        ...jobArgs,
        week: Schema.String,
        context: Schema.optional(Schema.String),
      }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            items: Schema.Array(
              Schema.Struct({
                id: itemId,
                category: Schema.String,
                description: Schema.String,
                note: Schema.String,
              }),
            ),
            plans: Schema.Array(
              Schema.Struct({
                id: Id("wardrobes"),
                name: Schema.String,
                description: Schema.String,
                itemIds: Schema.Array(itemId),
              }),
            ),
            bio: Schema.String,
            history: Schema.Array(Schema.String),
            inventoryTruncated: Schema.Boolean,
            suggestions: Schema.Array(
              Schema.Struct({
                date: Schema.String,
                status: Schema.String,
                itemIds: Schema.Array(itemId),
                reason: Schema.optional(Schema.String),
              }),
            ),
          }),
        ),
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "commit",
      args: () => ({
        ...jobArgs,
        outfits: Schema.Array(autoOutfit),
        calendarDerived: Schema.Boolean,
        calendarRevision: Schema.Number,
      }),
      returns: () => Schema.Boolean,
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "finish",
      args: () => ({
        ...jobArgs,
        error: Schema.optional(Schema.Literals(["calendar", "generation"])),
      }),
      returns: () => Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expire",
      args: () => jobArgs,
      returns: () => Schema.Null,
    }),
  );
