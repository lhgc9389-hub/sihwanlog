import Link from 'next/link';
import { CATEGORY_LABELS, FEATURE_KEYS, type OutingPlace } from '@/lib/types.ts';
import { FeatureChip, SampleBadge, VerifyBadge } from './Badges';

export function PlaceCard({ place }: { place: OutingPlace }) {
  return (
    <Link
      href={`/places/${place.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sand bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-coral"
    >
      <div aria-hidden className="grid h-28 place-items-center bg-gradient-to-br from-peach/60 to-sand text-5xl">
        {place.emoji}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {place.isSample && <SampleBadge />}
          {place.category && (
            <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-soft">{CATEGORY_LABELS[place.category]}</span>
          )}
          <VerifyBadge status={place.verifyStatus} />
        </div>
        <h3 className="text-lg font-bold group-hover:text-coral-dark">{place.name}</h3>
        <p className="text-sm text-ink-soft">
          {place.sido} {place.sigungu}
        </p>
        <p className="line-clamp-2 text-sm">{place.summary}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {FEATURE_KEYS.map((k) => (
            <FeatureChip key={k} k={k} v={place.features[k]} />
          ))}
        </div>
      </div>
    </Link>
  );
}
