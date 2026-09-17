import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import garmentIdentityQueries from "../../garmentIdentityQueries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../garmentIdentityQueries.spec")["default"]>(databaseSchema, garmentIdentityQueries, RegisteredConvexFunction.make);
