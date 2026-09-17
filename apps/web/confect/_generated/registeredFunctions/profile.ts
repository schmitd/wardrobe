import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import profile from "../../profile.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../profile.spec")["default"]>(databaseSchema, profile, RegisteredConvexFunction.make);
