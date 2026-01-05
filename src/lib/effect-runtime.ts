import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { Layer } from "effect"

// Define the tracer layer
const NodeSdkLive = NodeSdk.layer(() => {
    const axiomToken = process.env.AXIOM_TOKEN
    const axiomDataset = process.env.AXIOM_DATASET

    if (!axiomToken || !axiomDataset) {
        console.warn("Axiom credentials missing, telemetry disabled.")
        return {
            resource: { serviceName: "wardrobe-ai" }
        }
    }

    return {
        resource: { serviceName: "wardrobe-ai" },
        spanProcessor: new BatchSpanProcessor(
            new OTLPTraceExporter({
                url: "https://api.axiom.co/v1/traces",
                headers: {
                    Authorization: `Bearer ${axiomToken}`,
                    "X-Axiom-Dataset": axiomDataset,
                },
            })
        ),
        logRecordProcessor: new BatchLogRecordProcessor(
            new OTLPLogExporter({
                url: "https://api.axiom.co/v1/logs",
                headers: {
                    Authorization: `Bearer ${axiomToken}`,
                    "X-Axiom-Dataset": axiomDataset,
                },
            })
        )
    }
})

export const RuntimeLive = NodeSdkLive
