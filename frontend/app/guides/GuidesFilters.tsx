'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, Filter, X } from 'lucide-react'

interface Channel {
  id: string
  name: string
}

interface GuidesFiltersProps {
  channels: Channel[]
  currentChannel?: string
  currentSearch?: string
}

export default function GuidesFilters({ channels, currentChannel, currentSearch }: GuidesFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(currentSearch || '')

  const updateFilters = (updates: { channel?: string | null; search?: string | null; resetPage?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString())

    // Reset to page 1 when filters change
    if (updates.resetPage) {
      params.delete('page')
    }

    if (updates.channel !== undefined) {
      if (updates.channel) {
        params.set('channel', updates.channel)
      } else {
        params.delete('channel')
      }
    }

    if (updates.search !== undefined) {
      if (updates.search) {
        params.set('search', updates.search)
      } else {
        params.delete('search')
      }
    }

    const query = params.toString()
    startTransition(() => {
      router.push(`/guides${query ? `?${query}` : ''}`)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchValue || null, resetPage: true })
  }

  const clearFilters = () => {
    setSearchValue('')
    startTransition(() => {
      router.push('/guides')
    })
  }

  const hasFilters = currentChannel || currentSearch

  return (
    <div className="mb-8 space-y-4">
      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Rechercher un guide..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchValue('')
                  if (currentSearch) {
                    updateFilters({ search: null, resetPage: true })
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </form>

        {/* Channel Filter */}
        <div className="relative sm:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <select
            value={currentChannel || ''}
            onChange={(e) => updateFilters({ channel: e.target.value || null, resetPage: true })}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="">Toutes les chaînes</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500">Filtres actifs:</span>

          {currentSearch && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              Recherche: "{currentSearch}"
              <button
                onClick={() => {
                  setSearchValue('')
                  updateFilters({ search: null, resetPage: true })
                }}
                className="hover:text-blue-900"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          )}

          {currentChannel && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
              {channels.find(c => c.id === currentChannel)?.name || 'Chaîne'}
              <button
                onClick={() => updateFilters({ channel: null, resetPage: true })}
                className="hover:text-purple-900"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          )}

          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Effacer tout
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isPending && (
        <div className="flex justify-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
