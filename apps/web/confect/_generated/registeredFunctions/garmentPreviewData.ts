import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import garmentPreviewData from "../../garmentPreviewData.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../garmentPreviewData.spec")["default"]>(databaseSchema, garmentPreviewData, RegisteredConvexFunction.make);
