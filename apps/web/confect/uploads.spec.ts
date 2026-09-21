import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";
import { Id } from "./_generated/id";
import { InvalidUploadTicket } from "./errors";
export default GroupSpec.make()
  .addFunction(FunctionSpec.internalMutation({ name: "claim", args: () => ({ token: Schema.String }), returns: () => Id("uploadTickets"), error: () => InvalidUploadTicket }))
  .addFunction(FunctionSpec.internalMutation({ name: "finalize", args: () => ({ ticketId: Id("uploadTickets"), storageId: GenericId.GenericId("_storage") }), returns: () => Schema.Null, error: () => InvalidUploadTicket }))
  .addFunction(FunctionSpec.internalMutation({ name: "expire", args: () => ({ ticketId: Id("uploadTickets") }), returns: () => Schema.Null }));
