import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import candidates from "../../candidates.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../candidates.spec")["default"]>(databaseSchema, candidates, RegisteredConvexFunction.make);
