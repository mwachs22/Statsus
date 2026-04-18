import dns from 'dns';

function ssrfError(msg: string): Error {
  return Object.assign(new Error(msg), { statusCode: 400 });
}

function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts;
  return (
    a === 127 ||                              // 127.0.0.0/8  loopback
    a === 10 ||                               // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) ||      // 172.16.0.0/12
    (a === 192 && b === 168) ||               // 192.168.0.0/16
    (a === 169 && b === 254)                  // 169.254.0.0/16  link-local / AWS IMDS
  );
}

function isPrivateIPv6(addr: string): boolean {
  const normalized = addr.toLowerCase();
  if (normalized === '::1') return true;       // loopback
  // fc00::/7 — ULA (covers fc:: and fd::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // fe80::/10 — link-local
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  return false;
}

function isPrivateAddress(addr: string): boolean {
  // Strip IPv6-mapped IPv4 prefix (::ffff:1.2.3.4)
  const ipv4Mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) return isPrivateIPv4(ipv4Mapped[1]);
  if (addr.includes(':')) return isPrivateIPv6(addr);
  return isPrivateIPv4(addr);
}

/**
 * Validates that a user-supplied URL does not target private/internal infrastructure.
 * Throws a 400-coded Error if the URL is unsafe.
 *
 * Allowlisted: `host.docker.internal` (Docker Desktop's well-known hostname for
 * reaching the host machine — used by Ollama users per the docs).
 */
export async function validateEndpointUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw ssrfError('Invalid endpoint URL');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicit allowlist — known safe hostnames that happen to resolve to private IPs
  if (hostname === 'host.docker.internal') return;

  // Sync blocklist — no DNS needed
  if (hostname === 'localhost') {
    throw ssrfError('Endpoint URL must not target localhost');
  }
  if (!hostname.includes('.')) {
    // No dot = bare hostname = likely a Docker service name (db, caddy, webmail, redis…)
    throw ssrfError('Endpoint URL hostname must be a fully-qualified domain name');
  }
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw ssrfError('Endpoint URL must not target .local or .internal hostnames');
  }

  // DNS resolution + private IP check
  let address: string;
  try {
    const result = await dns.promises.lookup(hostname, { verbatim: true });
    address = result.address;
  } catch {
    throw ssrfError('Endpoint hostname could not be resolved');
  }

  if (isPrivateAddress(address)) {
    throw ssrfError('Endpoint URL must not resolve to a private or internal IP address');
  }
}
