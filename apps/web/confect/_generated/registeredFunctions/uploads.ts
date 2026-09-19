import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import uploads from "../../uploads.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../uploads.spec")["default"]>(databaseSchema, uploads, RegisteredConvexFunction.make);
