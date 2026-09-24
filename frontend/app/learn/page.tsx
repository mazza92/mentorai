import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/Footer'
import SearchHeader from '@/components/SearchHeader'
import { CLUSTER_LABEL, getAllTopics, type TopicCluster } from '@/data/topics'

export const metadata: Metadata = {
  title: 'Ranked YouTube topics: skip the bait',
  description:
    "Don't trust the thumbnail. Outcome hubs ranked by comments, likes, and depth. Playbooks you can run now.",
  alternates: { canonical: 'https://lurnia.app/learn' }
}

export default function LearnIndexPage() {
  const topics = getAllTopics()
  const clusters = (Object.keys(CLUSTER_LABEL) as TopicCluster[]).map((cluster) => ({
    cluster,
    label: CLUSTER_LABEL[cluster],
    items: topics.filter((topic) => topic.cluster === cluster)
  })).filter((group) => group.items.length)

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-violet-50/40">
      <SearchHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-16 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">
          Don&apos;t trust the thumbnail
        </p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          Ranked topics.
          <span className="mt-2 block bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Not dumped YouTube titles.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          One hub per intent. We answer the question, rank videos by real engagement, then hand you a playbook to run now.
        </p>

        <div className="mt-12 space-y-12">
          {clusters.map((group) => (
            <section key={group.cluster}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{group.label}</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {group.items.map((topic) => (
                  <li key={topic.slug}>
                    <Link
                      href={`/learn/${topic.slug}`}
                      className="block h-full rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm shadow-indigo-500/5 transition hover:border-violet-300 hover:bg-violet-50/40"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{topic.lang}</p>
                      <h3 className="mt-1 font-bold text-slate-900">{topic.h1}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{topic.definition.slice(0, 140)}…</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
