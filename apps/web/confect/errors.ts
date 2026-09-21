import { Schema } from "effect";

export class NotAuthenticated extends Schema.TaggedError<NotAuthenticated>()(
  "NotAuthenticated", { message: Schema.String },
) {}

export class StorageNotOwned extends Schema.TaggedError<StorageNotOwned>()(
  "StorageNotOwned", { message: Schema.String },
) {}

export class InvalidUploadTicket extends Schema.TaggedError<InvalidUploadTicket>()(
  "InvalidUploadTicket", { message: Schema.String },
) {}
