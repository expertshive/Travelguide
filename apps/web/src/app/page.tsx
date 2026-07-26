export default function Home() {
  const features = [
    {
      title: 'Discover places',
      desc: 'Find destinations, landmarks, and hidden gems curated for travelers.',
    },
    {
      title: 'Plan your trips',
      desc: 'Build itineraries, save routes, and organize every detail in one place.',
    },
    {
      title: 'Travel together',
      desc: 'Connect with guides, share experiences, and explore with confidence.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Traveler Guide
          </p>
          <a
            href="http://localhost:3002/login"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
          >
            Admin
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Welcome
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-zinc-900">
            Your travel companion for every journey
          </h1>
          <p className="mt-6 text-xl leading-8 text-zinc-600">
            Traveler Guide helps you discover destinations, plan memorable trips, and share
            adventures — from the first idea to the final photo.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#features"
              className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white"
            >
              Explore features
            </a>
            <a
              href="http://localhost:3002/login"
              className="inline-flex h-12 items-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900"
            >
              Admin login
            </a>
          </div>
        </section>

        <section id="features" className="mt-20 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-zinc-900">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{feature.desc}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6 text-sm text-zinc-500">
          Traveler Guide — introduction website. Platform management is available in the admin
          portal.
        </div>
      </footer>
    </div>
  );
}
