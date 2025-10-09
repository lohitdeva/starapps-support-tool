import ShopifyPricingCalculator from "./ShopifyPricingCalculator";
import Landing from "./Landing";
import UrlGenerator from "./UrlGenerator";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

type Page = "home" | "calculator" | "urlgen";

export default function App({ page }: { page: Page }) {
  return (
    <main className="min-h-screen bg-gray-50">
      <HeaderNav page={page} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {page === "home" && <Landing />}
        {page === "calculator" && <ShopifyPricingCalculator />}
        {page === "urlgen" && <UrlGenerator />}
      </div>
      <Analytics />
      <SpeedInsights />
    </main>
  );
}

function HeaderNav({ page }: { page: Page }) {
  const link = (href: string, label: string, active: boolean) => (
    <a
      href={href}
      className={
        "px-3 py-1.5 rounded-lg text-sm border " +
        (active
          ? "bg-gray-900 text-white border-gray-900"
          : "hover:bg-gray-50 border-gray-300 text-gray-700")
      }
    >
      {label}
    </a>
  );

  return (
    <header className="sticky top-0 z-10 bg-white">
      <div className="h-1 bg-black" />
      <div className="border-b border-gray-200">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <a
                href="/"
                aria-label="Go to Support Tool landing"
                className="flex items-center gap-2"
              >
                <img
                  src="/logo.svg"
                  alt="StarApps Studio Logo"
                  className="h-8 w-8"
                />
                <span className="text-2xl font-bold text-gray-800 hover:text-blue-700">
                  Support Tool
                </span>
              </a>
              <span className="hidden md:inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                by Lohit Deva
              </span>
            </div>
          </div>
          {page !== "home" && (
            <nav className="flex items-center gap-2">
              {link(
                "/calculator/",
                "Pricing Calculator",
                page === "calculator"
              )}
              {link("/urlgen/", "URL Generator", page === "urlgen")}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
