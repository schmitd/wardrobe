import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { Layer } from "effect"

// Define the tracer layer
const NodeSdkLive = NodeSdk.layer(() => ({
    resource: { serviceName: "wardrobe-ai" },
    spanProcessor: new BatchSpanProcessor(
        new OTLPTraceExporter({
            url: "https://api.axiom.co/v1/traces",
            headers: {
                Authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
                "X-Axiom-Dataset": process.env.AXIOM_DATASET!,
            },
        })
    ),
    logRecordProcessor: new BatchLogRecordProcessor(
        new OTLPLogExporter({
            url: "https://api.axiom.co/v1/logs",
            headers: {
                Authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
                "X-Axiom-Dataset": process.env.AXIOM_DATASET!,
            },
        })
    )
}))

export const RuntimeLive = NodeSdkLive
