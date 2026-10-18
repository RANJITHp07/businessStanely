import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/website-analytics?days=30 - page views recorded by the public
// website (PageView, written by its /api/track) over the last N days: totals,
// a per-day series in India time, top breakdowns and the latest visits.
//
// "Visitors" counts distinct visitorId values. The id is a daily hash, so one
// person on three different days counts as three visitors over a 30-day range,
// the same way Vercel Analytics counts them.

const ALLOWED_DAYS = [1, 7, 30, 90, 365];
const TIMEZONE = "Asia/Kolkata";
const TOP_LIMIT = 10;

type Bucket = { name: string; views: number; visitors: number };

/** Group by `field`, nulls bucketed under `fallback`, busiest first. */
function topBy(field: string, fallback: string) {
  return [
    { $group: { _id: { $ifNull: [`$${field}`, fallback] }, views: { $sum: 1 }, v: { $addToSet: "$visitorId" } } },
    { $project: { _id: 0, name: "$_id", views: 1, visitors: { $size: "$v" } } },
    { $sort: { views: -1 } },
    { $limit: TOP_LIMIT },
  ];
}

/** India-time calendar date (YYYY-MM-DD) for a Date. */
function indiaDay(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requested = Number(req.nextUrl.searchParams.get("days"));
    const days = ALLOWED_DAYS.includes(requested) ? requested : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const raw = (await prisma.pageView.aggregateRaw({
      pipeline: [
        { $match: { createdAt: { $gte: { $date: since.toISOString() } } } },
        {
          $facet: {
            totals: [
              { $group: { _id: null, views: { $sum: 1 }, v: { $addToSet: "$visitorId" } } },
              { $project: { _id: 0, views: 1, visitors: { $size: "$v" } } },
            ],
            daily: [
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE } },
                  views: { $sum: 1 },
                  v: { $addToSet: "$visitorId" },
                },
              },
              { $project: { _id: 0, date: "$_id", views: 1, visitors: { $size: "$v" } } },
            ],
            pages: topBy("path", "/"),
            referrers: topBy("referrer", "Direct"),
            campaigns: topBy("utmSource", "None"),
            countries: topBy("country", "Unknown"),
            cities: topBy("city", "Unknown"),
            devices: topBy("device", "Unknown"),
            browsers: topBy("browser", "Other"),
            os: topBy("os", "Other"),
            recent: [
              { $sort: { createdAt: -1 } },
              { $limit: 50 },
              {
                $project: {
                  _id: 0,
                  path: 1,
                  referrer: 1,
                  utmSource: 1,
                  maskedIp: 1,
                  country: 1,
                  city: 1,
                  device: 1,
                  browser: 1,
                  os: 1,
                  createdAt: { $dateToString: { format: "%Y-%m-%dT%H:%M:%S.%LZ", date: "$createdAt" } },
                },
              },
            ],
          },
        },
      ],
    })) as unknown as Array<Record<string, any>>;

    const facet = raw[0] ?? {};
    const totals = facet.totals?.[0] ?? { views: 0, visitors: 0 };

    // Fill days with no traffic so the chart has an unbroken axis.
    const byDate = new Map<string, { views: number; visitors: number }>(
      (facet.daily ?? []).map((d: any) => [d.date, { views: d.views, visitors: d.visitors }]),
    );
    const daily: Array<{ date: string; views: number; visitors: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = indiaDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
      daily.push({ date, ...(byDate.get(date) ?? { views: 0, visitors: 0 }) });
    }

    const pick = (key: string): Bucket[] => facet[key] ?? [];

    return NextResponse.json({
      days,
      totals: { views: totals.views, visitors: totals.visitors },
      daily,
      pages: pick("pages"),
      referrers: pick("referrers"),
      campaigns: pick("campaigns"),
      countries: pick("countries"),
      cities: pick("cities"),
      devices: pick("devices"),
      browsers: pick("browsers"),
      os: pick("os"),
      recent: facet.recent ?? [],
    });
  } catch (error) {
    console.error("Error fetching website analytics:", error);
    return NextResponse.json({ error: "Failed to fetch website analytics" }, { status: 500 });
  }
}
