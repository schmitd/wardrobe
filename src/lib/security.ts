import ipaddr from 'ipaddr.js';
import dns from 'node:dns/promises';
import { Effect } from 'effect';

export class SecurityError extends Error {
    readonly _tag = "SecurityError";
    constructor(message: string) {
        super(message);
    }
}

/**
 * Checks if an IP address is private, loopback, or link-local.
 * Blocks:
 * - IPv4 Private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - Loopback: 127.0.0.0/8, ::1
 * - Link-Local: 169.254.0.0/16 (AWS metadata), fe80::/10
 * - Unique Local (IPv6): fc00::/7
 * - Unspecified: 0.0.0.0, ::
 * - IPv4-mapped IPv6 addresses that are private
 */
export const isPrivateIP = (ip: string): boolean => {
    try {
        const parsed = ipaddr.parse(ip);
        const range = parsed.range();

        // Block obvious private ranges
        if (range === 'private' || range === 'loopback' || range === 'linkLocal' || range === 'uniqueLocal' || range === 'unspecified') {
            return true;
        }

        // Special check for IPv4 mapped IPv6
        if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
            const ipv4 = (parsed as ipaddr.IPv6).toIPv4Address();
            const ipv4Range = ipv4.range();
            return ipv4Range === 'private' || ipv4Range === 'loopback' || ipv4Range === 'linkLocal' || ipv4Range === 'unspecified';
        }

        return false;
    } catch (_e) {
        // If IP is invalid, fail closed
        return true;
    }
}

/**
 * Validates a URL to ensure it does not point to a private network.
 * Resolves DNS to check for DNS rebinding attacks on the initial resolution.
 */
export const validateImageUrl = (url: string): Effect.Effect<void, SecurityError> =>
    Effect.gen(function* () {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return yield* Effect.fail(new SecurityError('Invalid URL'));
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return yield* Effect.fail(new SecurityError(`Invalid protocol: ${parsed.protocol}`));
        }

        const hostname = parsed.hostname;

        // 1. Hostname Blacklist Check (Basic sanity check)
        const blockedHostnames = ['localhost', 'metadata.google.internal', 'instance-data'];
        if (blockedHostnames.includes(hostname)) {
            return yield* Effect.fail(new SecurityError('Access to internal hostnames is denied'));
        }

        // 2. DNS Resolution & IP Validation

        // Check if hostname is already an IP
        if (ipaddr.isValid(hostname)) {
            if (isPrivateIP(hostname)) {
                return yield* Effect.fail(new SecurityError(`IP address ${hostname} is blocked`));
            }
            return;
        }

        // Resolve DNS
        const addresses = yield* Effect.tryPromise({
            try: () => dns.lookup(hostname, { all: true }),
            catch: (error) => new SecurityError(`DNS resolution failed: ${String(error)}`)
        });

        if (addresses.length === 0) {
            return yield* Effect.fail(new SecurityError(`Could not resolve hostname: ${hostname}`));
        }

        for (const { address } of addresses) {
            if (isPrivateIP(address)) {
                return yield* Effect.fail(new SecurityError(`Hostname ${hostname} resolves to blocked IP ${address}`));
            }
        }
    });
