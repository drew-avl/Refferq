import { syntheticKey } from './normalize';

export interface ProviderDefinition {
  slug: string;
  name: string;
  aliases: readonly string[];
}

// Stable slugs are integration keys. Add aliases; never rename an existing slug.
export const CONNECTPATH_PROVIDERS: readonly ProviderDefinition[] = [
  { slug: 'att', name: 'AT&T', aliases: ['att', 'at&t', 'at&t fiber', 'att fiber'] },
  { slug: 'spectrum', name: 'Spectrum', aliases: ['spectrum', 'charter', 'charter spectrum'] },
  { slug: 'xfinity', name: 'Xfinity', aliases: ['xfinity', 'comcast', 'comcast business'] },
  { slug: 'frontier', name: 'Frontier', aliases: ['frontier', 'frontier fiber'] },
  { slug: 'verizon', name: 'Verizon', aliases: ['verizon', 'verizon fios', 'fios'] },
  { slug: 'tmobile', name: 'T-Mobile', aliases: ['t-mobile', 'tmobile', 't-mobile business'] },
  { slug: 'windstream-kinetic', name: 'Kinetic by Windstream', aliases: ['windstream', 'kinetic', 'kinetic by windstream'] },
  { slug: 'centurylink-quantum', name: 'Quantum Fiber / CenturyLink', aliases: ['centurylink', 'quantum', 'quantum fiber'] },
  { slug: 'google-fiber', name: 'Google Fiber', aliases: ['google fiber', 'googlefiber'] },
  { slug: 'starlink', name: 'Starlink', aliases: ['starlink', 'space x starlink', 'spacex starlink'] },
] as const;

function normalizeAlias(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BY_ALIAS = new Map(CONNECTPATH_PROVIDERS.flatMap((provider) =>
  [provider.slug, provider.name, ...provider.aliases].map((alias) => [normalizeAlias(alias), provider] as const)
));

export function resolveProvider(value: string) {
  return BY_ALIAS.get(normalizeAlias(value)) || null;
}

export function providerAvailabilityKey(locationId: string, providerSlug: string, serviceType: string) {
  return syntheticKey(locationId, providerSlug, serviceType);
}

