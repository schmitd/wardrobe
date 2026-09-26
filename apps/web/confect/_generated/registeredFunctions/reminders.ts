import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import reminders from "../../reminders.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../reminders.spec")["default"]>(databaseSchema, reminders, RegisteredConvexFunction.make);
