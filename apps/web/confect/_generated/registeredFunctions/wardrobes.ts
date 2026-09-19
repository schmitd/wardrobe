import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import wardrobes from "../../wardrobes.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../wardrobes.spec")["default"]>(databaseSchema, wardrobes, RegisteredConvexFunction.make);
