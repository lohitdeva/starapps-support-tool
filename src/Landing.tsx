import React, { useEffect, useState } from "react";

type TState = { date: Date };

type IpGeo = {
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
  timezone?: string;
};

type Bucket = "night" | "early" | "morning" | "afternoon" | "evening";

const GREETINGS: Record<Bucket, string[]> = {
  night: [
    "What's up, after-hours avenger? 🌃",
    "Greetings, night ninja! 🥷",
    "Hello, moonlight maestro! 🌙",
    "Hey, graveyard guardian! 🌑",
  ],
  early: [
    "Rise and grind, sunrise superhero! 🌅",
    "Morning, dawn defender! 🛡️",
    "Greetings, early-bird explorer! 🐦",
    "Hello, daybreak dynamo ☀️",
  ],
  morning: [
    "Top of the morning, coffee crusader ☕️",
    "Hey there, sunshine strategist! 🌞",
    "Greetings, bright-side builder! ✨",
    "Hello, morning maestro! 🎶",
  ],
  afternoon: [
    "What's up, midday maverick! 🌤️",
    "Hello, lunch-hour legend! 🍱",
    "Greetings, productivity powerhouse! ⚡️",
    "Hey, golden-hour guru! 🌻",
  ],
  evening: [
    "Evening, twilight trailblazer! 🌇",
    "Hey there, sunset sentinel! 🌆",
    "Hello, dusk dynamo! 🌙",
    "Greetings, evening explorer! 🧭",
  ],
};

function bucketFromHour(hour: number): Bucket {
  if (hour < 4) return "night";
  if (hour < 8) return "early";
  if (hour < 12) return "morning";
  if (hour < 16) return "afternoon";
  if (hour < 20) return "evening";
  return "night";
}

function secureRandom() {
  if (globalThis.crypto?.getRandomValues) {
    const u32 = new Uint32Array(1);
    globalThis.crypto.getRandomValues(u32);
    return u32[0] / 2 ** 32;
  }
  return Math.random();
}

function pickRandomGreeting(bucket: Bucket) {
  const list = GREETINGS[bucket];
  return list[Math.floor(secureRandom() * list.length)];
}

function parseApiDate(j: any): Date | null {
  // Prefer an explicit UTC field if present (worldtimeapi)
  const utc = j.utcDateTime || j.utc_datetime;
  if (utc) return new Date(utc); // e.g., "2025-09-30T06:00:00Z"

  const s: string | undefined = j.dateTime || j.datetime;
  if (!s) return null;

  // If string already has a timezone (Z or +HH:MM), use as-is
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) return new Date(s);

  // Otherwise it’s a naive local time: force IST
  return new Date(`${s}+05:30`);
}

export default function Landing() {
  const [state, setState] = useState<TState>({ date: new Date() });

  const [geo, setGeo] = useState<IpGeo | null>(null);

  useEffect(() => {
    // update exactly on the second boundary to avoid drift
    let timeoutId: number;
    let intervalId: number;

    const start = () => {
      const now = Date.now();
      const msToNextSecond = 1000 - (now % 1000);
      timeoutId = window.setTimeout(() => {
        setState({ date: new Date() });
        intervalId = window.setInterval(() => {
          setState({ date: new Date() });
        }, 1000);
      }, msToNextSecond);
    };

    start();
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch("https://ipapi.co/json/", {
          cache: "no-store", // avoid caching across users
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw new Error(`ipapi ${r.status}`);
        const j = (await r.json()) as IpGeo;
        setGeo(j);
      } catch {
        setGeo(null); // silent failure; UI simply won't show location
      }
    })();
    return () => ac.abort();
  }, []);

  const date = state.date;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(date)
  );

  const bucket = bucketFromHour(hour);
  const greeting = React.useMemo(() => pickRandomGreeting(bucket), [bucket]);

  const prettyIST = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return (
    <div className="max-w-3xl mx-auto text-center">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">{greeting}</h1>
      <p className="text-gray-600 mb-8">
        Exact IST: <span className="font-medium">{prettyIST} IST</span>
        <br></br>
        {(geo?.city || geo?.country_name || geo?.country) &&
          `Your location: ${geo?.city ? `${geo.city}, ` : ""}${
            geo?.country_name ?? geo?.country
          }${geo?.timezone ? ` · ${geo.timezone}` : ""}`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="/calculator/"
          className="block rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 p-6 shadow text-left"
        >
          <div className="text-xl font-semibold mb-1">Pricing Calculator</div>
          <p className="text-gray-600 text-sm">
            Generate quick pricing based on Shopify tier with global/per-app
            discounts and optional currency conversion.
          </p>
        </a>

        <a
          href="/urlgen/"
          className="block rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 p-6 shadow text-left"
        >
          <div className="text-xl font-semibold mb-1">URL Generator</div>
          <p className="text-gray-600 text-sm">
            Generate specific Shopify links to redirect merchants to the desired
            page inside the Shopify admin.
          </p>
        </a>
      </div>
    </div>
  );
}
