import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import wear from "../../wear.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../wear.spec")["default"]>(databaseSchema, wear, RegisteredConvexFunction.make);
