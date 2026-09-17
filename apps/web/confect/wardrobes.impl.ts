import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import databaseSchema from "./_generated/schema";
import group from "./wardrobes.spec";
import * as functions from "./legacy/wardrobes";

export default GroupImpl.make(databaseSchema, group).pipe(
  Layer.provide(Layer.mergeAll(
    FunctionImpl.make(databaseSchema, group, "listWardrobes", functions.listWardrobes),
    FunctionImpl.make(databaseSchema, group, "getWardrobeDetail", functions.getWardrobeDetail),
    FunctionImpl.make(databaseSchema, group, "createWardrobe", functions.createWardrobe),
    FunctionImpl.make(databaseSchema, group, "updateWardrobe", functions.updateWardrobe),
    FunctionImpl.make(databaseSchema, group, "addItemToWardrobe", functions.addItemToWardrobe),
    FunctionImpl.make(databaseSchema, group, "removeItemFromWardrobe", functions.removeItemFromWardrobe),
  )),
  GroupImpl.finalize,
);
