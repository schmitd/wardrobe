import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import storageMigration from "../../storageMigration.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../storageMigration.spec")["default"]>(databaseSchema, storageMigration, RegisteredConvexFunction.make);
