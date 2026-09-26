import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import garmentPreview from "../../garmentPreview.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../garmentPreview.spec")["default"]>(databaseSchema, garmentPreview, RegisteredNodeFunction.make);
