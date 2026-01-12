import { Layer } from "effect"
import { GeminiLive } from "./GeminiService"
import { SupabaseLive } from "./SupabaseService"
import { DatabaseLive } from "./DatabaseService"
import { ArcjetLive } from "./ArcjetService"

export const AppLive = Layer.mergeAll(
    GeminiLive,
    SupabaseLive,
    DatabaseLive,
    ArcjetLive
)
