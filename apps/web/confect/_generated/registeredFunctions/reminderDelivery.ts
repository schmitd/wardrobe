import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import reminderDelivery from "../../reminderDelivery.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../reminderDelivery.spec")["default"]>(databaseSchema, reminderDelivery, RegisteredNodeFunction.make);
