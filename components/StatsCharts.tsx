'use client'

// All charts in /stats. Takes pre-aggregated data from the cached getStatsData()
// — zero client-side aggregation. Recharts under the hood via shadcn's `Chart`
// primitives.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { StatsData } from '@/lib/queries/restaurants'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

// ---------- Stat cards ----------

export function StatTiles({ data }: { data: StatsData }) {
  const tiles = [
    { label: 'Visited', value: data.statusTotals.visited },
    { label: 'Want to try', value: data.statusTotals.want_to_try },
    { label: 'Chains', value: data.chainTotals.chains },
    { label: 'Independents', value: data.chainTotals.independents },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {t.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium tracking-tight tabular-nums">
              {t.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------- Cuisine bar (horizontal, top N + Other) ----------

function topNWithOther(
  counts: Record<string, number>,
  n: number
): Array<{ name: string; count: number }> {
  const sorted = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  if (sorted.length <= n) return sorted
  const top = sorted.slice(0, n)
  const otherCount = sorted.slice(n).reduce((s, x) => s + x.count, 0)
  return [...top, { name: 'Other', count: otherCount }]
}

export function CuisineBar({ counts }: { counts: Record<string, number> }) {
  const data = topNWithOther(counts, 10)
  const config: ChartConfig = { count: { label: 'Restaurants', color: 'var(--chart-1)' } }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuisines</CardTitle>
        <CardDescription>Top 10 plus the long tail.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/10] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---------- Rating bar ----------

export function RatingBar({
  dist,
}: {
  dist: StatsData['ratingDistribution']
}) {
  const data = [
    { key: '1', count: dist['1'] },
    { key: '2', count: dist['2'] },
    { key: '3', count: dist['3'] },
    { key: '4', count: dist['4'] },
    { key: '5', count: dist['5'] },
    { key: 'unrated', count: dist.unrated },
  ]
  const config: ChartConfig = { count: { label: 'Restaurants', color: 'var(--chart-2)' } }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ratings</CardTitle>
        <CardDescription>1–5 plus unrated.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/10] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---------- City bar (horizontal, sorted desc) ----------

export function CityBar({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
  const config: ChartConfig = { count: { label: 'Locations', color: 'var(--chart-3)' } }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cities</CardTitle>
        <CardDescription>Location count by city.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/10] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---------- Status donut ----------

export function StatusDonut({
  totals,
}: {
  totals: StatsData['statusTotals']
}) {
  const data = [
    { name: 'Visited', value: totals.visited, fill: 'var(--chart-1)' },
    { name: 'Want to try', value: totals.want_to_try, fill: 'var(--chart-3)' },
  ]
  const config: ChartConfig = {
    visited: { label: 'Visited', color: 'var(--chart-1)' },
    want_to_try: { label: 'Want to try', color: 'var(--chart-3)' },
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
        <CardDescription>Visited vs. want-to-try.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[260px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---------- Occasion / Wallet bars ----------

export function OccasionBar({
  counts,
}: {
  counts: StatsData['occasionCounts']
}) {
  const data = [
    { key: 'Quick', count: counts.Quick },
    { key: 'Casual', count: counts.Casual },
    { key: 'Elevated', count: counts.Elevated },
    { key: 'Fine Dine', count: counts['Fine Dine'] },
    { key: 'unset', count: counts.unset },
  ]
  const config: ChartConfig = { count: { label: 'Restaurants', color: 'var(--chart-4)' } }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Occasion</CardTitle>
        <CardDescription>Vibe tier distribution.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/10] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function WalletBar({
  counts,
}: {
  counts: StatsData['walletCounts']
}) {
  const data = [
    { key: 'Cheap', count: counts.Cheap },
    { key: 'Normal', count: counts.Normal },
    { key: 'Splurge', count: counts.Splurge },
    { key: 'Big night', count: counts['Big night'] },
    { key: 'unset', count: counts.unset },
  ]
  const config: ChartConfig = { count: { label: 'Restaurants', color: 'var(--chart-5)' } }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet</CardTitle>
        <CardDescription>Personal-relative spend tier.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/10] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ---------- Dietary stacked bar ----------

export function DietaryStacked({
  counts,
}: {
  counts: StatsData['dietaryCounts']
}) {
  const data = [
    { marker: 'Vegetarian', yes: counts.vegetarian.yes, no: counts.vegetarian.no, unknown: counts.vegetarian.unknown },
    { marker: 'Halal', yes: counts.halal.yes, no: counts.halal.no, unknown: counts.halal.unknown },
  ]
  const config: ChartConfig = {
    yes: { label: 'Yes', color: CHART_COLORS[0] },
    no: { label: 'No', color: CHART_COLORS[2] },
    unknown: { label: 'Unknown', color: CHART_COLORS[4] },
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dietary markers</CardTitle>
        <CardDescription>Yes / no / unknown per marker.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/10] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="marker" />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="yes" stackId="a" fill="var(--color-yes)" />
            <Bar dataKey="no" stackId="a" fill="var(--color-no)" />
            <Bar dataKey="unknown" stackId="a" fill="var(--color-unknown)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
