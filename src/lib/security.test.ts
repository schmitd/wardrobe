import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { isPrivateIP, validateImageUrl } from './security';
import dns from 'node:dns/promises';
import { Effect } from 'effect';

// Mock DNS lookup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLookup = mock(async (hostname: string, _options: any) => {
    if (hostname === 'google.com') {
        return [{ address: '142.250.190.46', family: 4 }];
    }
    if (hostname === 'localhost') {
        return [{ address: '127.0.0.1', family: 4 }];
    }
    if (hostname === 'private.local') {
        return [{ address: '192.168.1.5', family: 4 }];
    }
    if (hostname === 'aws.metadata') {
        return [{ address: '169.254.169.254', family: 4 }];
    }
    if (hostname === 'ipv6.local') {
        return [{ address: 'fe80::1', family: 6 }];
    }
    if (hostname === 'mixed.com') {
        // One public, one private (DNS Rebinding simulation attempt or misconfiguration)
        return [
            { address: '1.1.1.1', family: 4 },
            { address: '127.0.0.1', family: 4 }
        ];
    }
    if (hostname === 'nip.io.rebinding') {
        return [{ address: '127.0.0.1', family: 4 }];
    }
    throw new Error('ENOTFOUND');
});

describe('Security Utilities', () => {

    describe('isPrivateIP', () => {
        it('blocks loopback IPv4', () => {
            expect(isPrivateIP('127.0.0.1')).toBe(true);
            expect(isPrivateIP('127.0.0.100')).toBe(true);
        });

        it('blocks private ranges IPv4', () => {
            expect(isPrivateIP('10.0.0.1')).toBe(true);
            expect(isPrivateIP('192.168.1.1')).toBe(true);
            expect(isPrivateIP('172.16.0.1')).toBe(true);
            expect(isPrivateIP('172.31.255.255')).toBe(true);
        });

        it('allows public IPv4', () => {
            expect(isPrivateIP('8.8.8.8')).toBe(false);
            expect(isPrivateIP('1.1.1.1')).toBe(false);
        });

        it('blocks link-local (AWS metadata)', () => {
            expect(isPrivateIP('169.254.169.254')).toBe(true);
        });

        it('blocks IPv6 loopback', () => {
            expect(isPrivateIP('::1')).toBe(true);
        });

        it('blocks IPv6 link-local', () => {
            expect(isPrivateIP('fe80::1')).toBe(true);
        });

        it('blocks IPv6 unique-local', () => {
            expect(isPrivateIP('fd00::1')).toBe(true);
        });

        it('blocks IPv4-mapped IPv6 private', () => {
            expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
            expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
        });

        it('allows IPv4-mapped IPv6 public', () => {
            expect(isPrivateIP('::ffff:8.8.8.8')).toBe(false);
        });
    });

    describe('validateImageUrl', () => {
        beforeEach(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            dns.lookup = mockLookup;
        });

        // Restore mock is not strictly necessary as we are mocking module method but good practice
        // Bun's mock implementation might persist, so we rely on re-assignment if needed.

        it('allows valid public domain', async () => {
            const program = validateImageUrl('https://google.com/image.png');
            await expect(Effect.runPromise(program)).resolves.toBeUndefined();
        });

        it('blocks localhost string', async () => {
            const program = validateImageUrl('http://localhost/img.png');
            await expect(Effect.runPromise(program)).rejects.toThrow('Access to internal hostnames is denied');
        });

        it('blocks domain resolving to private IP', async () => {
            const program = validateImageUrl('http://private.local/img.png');
            await expect(Effect.runPromise(program)).rejects.toThrow('resolves to blocked IP');
        });

        it('blocks domain resolving to AWS metadata', async () => {
            const program = validateImageUrl('http://aws.metadata/latest');
            await expect(Effect.runPromise(program)).rejects.toThrow('resolves to blocked IP');
        });

        it('blocks mixed resolution (one public, one private)', async () => {
            const program = validateImageUrl('http://mixed.com');
            await expect(Effect.runPromise(program)).rejects.toThrow('resolves to blocked IP');
        });

        it('blocks numeric private IP in URL', async () => {
            const program = validateImageUrl('http://192.168.1.1/img.png');
            await expect(Effect.runPromise(program)).rejects.toThrow('IP address 192.168.1.1 is blocked');
        });

        it('allows numeric public IP in URL', async () => {
            const program = validateImageUrl('http://8.8.8.8/img.png');
            await expect(Effect.runPromise(program)).resolves.toBeUndefined();
        });

        it('blocks invalid protocol', async () => {
            const program = validateImageUrl('ftp://google.com/file');
            await expect(Effect.runPromise(program)).rejects.toThrow('Invalid protocol');
        });
    });
});
