import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import account from "../../account.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../account.spec")["default"]>(databaseSchema, account, RegisteredConvexFunction.make);
