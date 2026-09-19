import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import wardrobe from "../../wardrobe.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../wardrobe.spec")["default"]>(databaseSchema, wardrobe, RegisteredConvexFunction.make);
