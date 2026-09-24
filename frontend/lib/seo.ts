export const SITE_URL = 'https://lurnia.app'

export function isProbablyFrench(text: string) {
  return /[àâçéèêëîïôùûüÿœ]|\b(le|la|les|des|une|comment|tutoriel|avis|formation|méthode|créer|vidéo|pour|avec|cest|c'est)\b/i.test(text || '')
}

/** GSC last-12-months: high impressions, ~0% CTR. Titles stay ≤52 chars so `| Lurnia` still fits. */
export const SERP_OVERRIDES: Record<string, { title: string; description: string }> = {
  'linkuma-avis-franc-et-tuto-backlinks-pas-chers-jlWhHh': {
    title: 'Linkuma avis + tuto backlinks pas chers',
    description:
      'Ne te fie pas à la miniature. Avis franc sur Linkuma, tuto backlinks pas chers, et ce qu’il faut zapper. Playbook + timestamps.'
  },
  'tempo-labs-tutorial-the-ultimate-vibe-coding-packa-k6uBbU': {
    title: 'Tempo Labs tutorial: vibe coding playbook',
    description:
      "Don't trust the thumbnail. Tempo Labs playbook: what actually ships, timestamps, and the empty-scroll parts to skip."
  },
  'how-the-1-actually-build-apps-with-cursor-s-contex-QgA55E': {
    title: 'Cursor context engineering: the 1% method',
    description:
      "Don't trust the thumbnail. How the 1% actually build with Cursor: context, PRD, what to skip. Playbook + timestamps."
  },
  'qwen-3-actually-made-me-quit-claude-code-lXWazK': {
    title: 'Qwen vs Claude Code: keep this, skip that',
    description:
      "Don't trust the thumbnail. Qwen 3 vs Claude Code: what actually changed, when to switch, what to skip. Playbook."
  },
  'the-bmad-method-the-ultimate-ai-coding-system-fD8NLP': {
    title: "BMAD method: c'est quoi + playbook",
    description:
      "C'est quoi BMAD ? Ne te fie pas au titre YouTube. Méthode BMAD expliquée, étapes, et ce qu'il faut zapper. Playbook."
  },
  'mon-top-7-des-etf-pea-pour-2026-RZ48wb': {
    title: 'ETF IA éligibles PEA 2026: le top 7',
    description:
      "Ne te fie pas à la miniature. Top 7 ETF / actions IA éligibles PEA 2026, chiffres, caveats, ce qu'il faut zapper."
  },
  'comment-creer-et-vendre-des-agents-ia-de-a-a-z-for-Hl8u5D': {
    title: 'Créer et vendre des agents IA: playbook',
    description:
      "Ne te fie pas à la miniature. Agents IA de A à Z: offre, stack, vente, timestamps, et le fluff à zapper."
  },
  'dropshipping-2-0-comment-creer-une-boutique-shopif-e8FT3v': {
    title: 'Dropshipping 2.0 Shopify: playbook, pas le hook',
    description:
      "Ne te fie pas à la miniature. Dropshipping 2.0 + Shopify: ce qui marche encore, ce qui est du bait, timestamps."
  },
  'claude-code-tutorial-full-setup-mcp-and-cursor-ai--u-GGkt': {
    title: 'Claude Code + MCP + Cursor: setup playbook',
    description:
      "Don't trust the thumbnail. Claude Code tutorial: full setup, MCP, Cursor. Sequenced steps and what to skip."
  },
  '3-simple-ways-to-earn-money-with-claude-code-apps-Y2oK0n': {
    title: 'Earn with Claude Code apps: 3 real plays',
    description:
      "Don't trust the thumbnail. Three ways to earn with Claude Code: actions, caveats, timestamps. Not a 40-minute recap."
  },
  'la-fabrique-a-idiots-4xq6bV': {
    title: 'La Fabrique à idiots (Micode): le playbook',
    description:
      "Ne te fie pas à la miniature. Résumé utile de La Fabrique à idiots: thèses, timestamps, ce qu'il faut zapper."
  }
}

export function guideSerpTitle(metaTitle: string, videoTitle: string, slug: string) {
  const override = SERP_OVERRIDES[slug]
  if (override?.title) return override.title.slice(0, 60)

  const raw = (metaTitle || videoTitle || 'Playbook').replace(/\s+/g, ' ').trim()
  const fr = isProbablyFrench(`${raw} ${slug}`)
  const suffix = fr ? ': playbook' : ': skip bait'
  if (/playbook|skip bait|timestamps|what to skip/i.test(raw)) return raw.slice(0, 60)
  const budget = 60 - suffix.length
  const core = raw.length > budget ? raw.slice(0, Math.max(24, budget - 1)).replace(/\s+\S*$/, '') : raw
  return `${core}${suffix}`.slice(0, 60)
}

export function guideSerpDescription(metaDescription: string, videoTitle: string, slug: string) {
  const override = SERP_OVERRIDES[slug]
  if (override?.description) return override.description.slice(0, 155)

  const fr = isProbablyFrench(`${videoTitle} ${slug} ${metaDescription}`)
  const punch = fr ? 'Ne te fie pas à la miniature. ' : "Don't trust the thumbnail. "
  const rest = (metaDescription || '').replace(/\s+/g, ' ').trim()
  if (rest) {
    if (/ne te fie pas|don't trust the thumbnail/i.test(rest)) return rest.slice(0, 155)
    return `${punch}${rest}`.slice(0, 155)
  }
  const title = (videoTitle || '').slice(0, 50)
  return fr
    ? `${punch}Playbook de « ${title} » : à retenir, timestamps, ce qu’il faut zapper.`.slice(0, 155)
    : `${punch}Playbook from “${title}”: takeaways, timestamps, what to skip.`.slice(0, 155)
}

export const homepageFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How is Lurnia different from YouTube search?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'YouTube is paid to hook you. Lurnia re-ranks by whether people actually talked, liked, and stayed. Thumbnails do not get a vote.'
      }
    },
    {
      '@type': 'Question',
      name: 'Do you rank YouTube videos by views?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. High views with dead comments is usually a stop-scroller. We score comment rate, like rate, and long-form depth.'
      }
    },
    {
      '@type': 'Question',
      name: 'What is a Lurnia playbook?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The usable extract: takeaways, sequenced actions, timestamps, and what to skip, so you do not rewatch a 40-minute recap.'
      }
    },
    {
      '@type': 'Question',
      name: 'Can I ask a YouTube video questions?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Open any result and ask for the number, the caveat, or the next step. Answers come from captions and comments.'
      }
    },
    {
      '@type': 'Question',
      name: 'C’est quoi la différence entre Lurnia et YouTube ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'YouTube est payé pour te hooker. Lurnia reclasse selon si les gens ont vraiment parlé, liké, et resté. La miniature n’a pas de voix.'
      }
    },
    {
      '@type': 'Question',
      name: 'Vous classez les vidéos YouTube par nombre de vues ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Non. Beaucoup de vues et zéro discussion, c’est souvent du stop-scroll. On score le taux de commentaires, les likes, et le format long.'
      }
    }
  ]
}

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'Lurnia',
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      description:
        "Don't trust the thumbnail. Lurnia finds high-value YouTube videos by real engagement, not view count, then turns them into playbooks you can use now.",
      sameAs: [
        'https://chromewebstore.google.com/detail/lurnia-youtube-learning-c/fggidhdboaodfblhdigckdfcofimocim'
      ]
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Lurnia',
      inLanguage: ['en', 'fr'],
      publisher: { '@id': `${SITE_URL}/#org` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Lurnia',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, Chrome',
      url: SITE_URL,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Search YouTube without getting fooled by the thumbnail. Rank by comments, likes, and depth. Extract a playbook. Ask the video.'
    }
  ]
}
