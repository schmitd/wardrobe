import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import planning from "../../planning.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../planning.spec")["default"]>(databaseSchema, planning, RegisteredConvexFunction.make);
