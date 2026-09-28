import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import planningAuto from "../../planningAuto.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../planningAuto.spec")["default"]>(databaseSchema, planningAuto, RegisteredNodeFunction.make);
