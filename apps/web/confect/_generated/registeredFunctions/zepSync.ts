import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import zepSync from "../../zepSync.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../zepSync.spec")["default"]>(databaseSchema, zepSync, RegisteredNodeFunction.make);
