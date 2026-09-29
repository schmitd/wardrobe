import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import planningAutoData from "../../planningAutoData.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../planningAutoData.spec")["default"]>(databaseSchema, planningAutoData, RegisteredConvexFunction.make);
