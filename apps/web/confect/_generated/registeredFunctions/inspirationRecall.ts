import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import inspirationRecall from "../../inspirationRecall.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../inspirationRecall.spec")["default"]>(databaseSchema, inspirationRecall, RegisteredConvexFunction.make);
