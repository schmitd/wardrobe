import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import mobile from "../../mobile.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../mobile.spec")["default"]>(databaseSchema, mobile, RegisteredConvexFunction.make);
