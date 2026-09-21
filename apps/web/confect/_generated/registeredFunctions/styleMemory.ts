import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import styleMemory from "../../styleMemory.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../styleMemory.spec")["default"]>(databaseSchema, styleMemory, RegisteredNodeFunction.make);
