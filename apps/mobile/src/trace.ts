import { getRandomBytes } from "expo-crypto";
export const createTraceId = () => Array.from(getRandomBytes(16), (byte) => byte.toString(16).padStart(2, "0")).join("");
