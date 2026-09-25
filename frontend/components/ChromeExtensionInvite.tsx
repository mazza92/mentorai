import Link from 'next/link'
import { Chrome, ArrowRight, Check } from 'lucide-react'
import { CHROME_STORE_URL } from '@/lib/chromeStore'

export default function ChromeExtensionInvite() {
  return (
    <section
      id="chrome-extension"
      aria-labelledby="chrome-extension-heading"
      className="border-b border-indigo-100/80 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 lg:py-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100">
            <Chrome className="h-3.5 w-3.5" aria-hidden="true" />
            Free Chrome extension
          </p>
          <h2
            id="chrome-extension-heading"
            className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl"
          >
            Lurnia Chrome extension
            <span className="mt-1 block bg-gradient-to-r from-sky-300 via-indigo-200 to-violet-200 bg-clip-text text-transparent">
              Rank YouTube on the tab you already have open.
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-indigo-100/90">
            Lurnia is a free Chrome extension for high-value YouTube search. It re-ranks videos by comments, like rate, and long-form depth instead of view count, then extracts a playbook (takeaways, timestamps, what to skip) and lets you ask the video from captions. Not affiliated with YouTube.
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-indigo-50 sm:grid-cols-3">
            {[
              'Find signal, not bait',
              'Steal the playbook',
              'Ask any video'
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-indigo-50"
            >
              <Chrome className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              Add to Chrome — free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href="/extension"
              className="text-sm font-semibold text-indigo-200 underline-offset-4 hover:text-white hover:underline"
            >
              See how the extension works
            </Link>
          </div>
          <p className="mt-3 text-xs text-indigo-200/70">
            One click from the Chrome Web Store. Works on youtube.com in Chrome, Edge, and Brave. Search stays free.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end" aria-hidden="true">
          <div className="absolute -inset-6 rounded-[28px] bg-violet-400/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white">
                  L
                </span>
                <span className="text-xs font-bold text-slate-800">Lurnia</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                On YouTube
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2">
              <div className="rounded-lg bg-indigo-50 py-1.5 text-center text-[11px] font-semibold text-indigo-700">
                Find signal
              </div>
              <div className="rounded-lg py-1.5 text-center text-[11px] font-medium text-slate-500">
                Ask
              </div>
            </div>
            <div className="space-y-2 px-3 pb-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                price a freelance offer
              </div>
              {[
                { score: 91, title: 'Pricing without the 40-min recap', meta: 'High discussion' },
                { score: 84, title: 'Rate card that actually books', meta: 'Hidden gem' }
              ].map((row) => (
                <div key={row.title} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-extrabold text-white">
                    {row.score}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{row.title}</p>
                    <p className="text-[10px] font-medium text-emerald-700">{row.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
