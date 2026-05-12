import { Suspense } from 'react'
import { BackLink } from '@/components/BackLink'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CityBar,
  CuisineBar,
  OccasionBar,
  RatingBar,
  StatTiles,
  StatusDonut,
  VegetarianBar,
  WalletBar,
} from '@/components/StatsCharts'
import { getStatsData } from '@/lib/queries/restaurants'
import type { Metadata } from 'next'
import { socialMetadata } from '@/lib/seo'

const STATS_DESCRIPTION =
  'Ratings, cuisines, cities, and dining habits across the journal.'

export const metadata: Metadata = {
  title: 'Stats',
  description: STATS_DESCRIPTION,
  ...socialMetadata({ title: 'Stats · Dining Guide', description: STATS_DESCRIPTION, path: '/stats' }),
}

const MIN_ROWS_FOR_CHARTS = 3

export default function StatsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
      <BackLink />
      <h1 className="text-2xl font-medium tracking-tight">Stats</h1>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsBody />
      </Suspense>
    </div>
  )
}

async function StatsBody() {
  const data = await getStatsData()

  if (data.totalRestaurants < MIN_ROWS_FOR_CHARTS) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Add a few restaurants to see stats.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StatTiles data={data} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CuisineBar counts={data.cuisineCounts} />
        <RatingBar dist={data.ratingDistribution} />
        <CityBar counts={data.cityCounts} />
        <StatusDonut totals={data.statusTotals} />
        <OccasionBar counts={data.occasionCounts} />
        <WalletBar counts={data.walletCounts} />
        <VegetarianBar counts={data.dietaryCounts} />
      </div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
