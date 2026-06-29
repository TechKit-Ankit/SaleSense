import { BarChart3, Boxes, ReceiptText, Wifi } from "lucide-react";

const modules = [
  {
    title: "POS Billing",
    description: "Barcode-first counter flow with invoice-ready sales.",
    icon: ReceiptText,
  },
  {
    title: "Inventory",
    description: "Batch-aware stock, expiry, purchase price, and movements.",
    icon: Boxes,
  },
  {
    title: "Offline Sync",
    description: "Local sale queue with reconciliation-ready sync events.",
    icon: Wifi,
  },
  {
    title: "Analytics",
    description: "Revenue, profit, dead stock, and product performance.",
    icon: BarChart3,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">SaleSense</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              Retail operations scaffold
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              The monorepo is ready for the planned POS, inventory, offline sync,
              analytics, and promotion intelligence modules.
            </p>
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Web app online
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <article
                key={module.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <Icon className="size-5 text-slate-700" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold text-slate-950">
                  {module.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {module.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

