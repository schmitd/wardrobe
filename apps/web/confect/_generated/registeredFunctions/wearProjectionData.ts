import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import wearProjectionData from "../../wearProjectionData.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../wearProjectionData.spec")["default"]>(databaseSchema, wearProjectionData, RegisteredConvexFunction.make);
