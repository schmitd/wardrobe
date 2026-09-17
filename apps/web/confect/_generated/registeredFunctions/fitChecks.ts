import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import fitChecks from "../../fitChecks.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../fitChecks.spec")["default"]>(databaseSchema, fitChecks, RegisteredConvexFunction.make);
