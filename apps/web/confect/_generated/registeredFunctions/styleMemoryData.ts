import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import styleMemoryData from "../../styleMemoryData.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../styleMemoryData.spec")["default"]>(databaseSchema, styleMemoryData, RegisteredConvexFunction.make);
