import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../schema";
import wearGraph from "../../wearGraph.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../wearGraph.spec")["default"]>(databaseSchema, wearGraph, RegisteredNodeFunction.make);
