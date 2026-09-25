import { CLUSTER_LABEL, getAllTopics, getTopicsByCluster, type TopicCluster } from '@/data/topics'
import { CHROME_STORE_URL } from '@/lib/chromeStore'

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
  },
  "formation-chatgpt-comment-utiliser-chatgpt-en-2025-Tuok-M": {
    title: "ChatGPT: The 2025 User Guide (Don't Trust the Thumbn",
    description:
      "Master ChatGPT in 2025. This guide cuts through the clickbait, showing you how to use ChatGPT effectively, beyond the hype. Get real strategies for AI."
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
      name: 'What is the Lurnia Chrome extension?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Lurnia is a free Chrome extension for high-value YouTube search. It re-ranks videos by comments, like rate, and long-form depth instead of view count, extracts a playbook (takeaways, timestamps, what to skip), and lets you ask the video from captions. It works on youtube.com in Chrome, Edge, and Brave.'
      }
    },
    {
      '@type': 'Question',
      name: 'How do I install the Lurnia Chrome extension?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Open the Lurnia listing on the Chrome Web Store and click Add to Chrome. It is free to install. Then open YouTube: Lurnia ranks the tab you already have open. Direct install: https://chromewebstore.google.com/detail/lurnia-youtube-learning-c/fggidhdboaodfblhdigckdfcofimocim'
      }
    },
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
      sameAs: [CHROME_STORE_URL]
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
      name: 'Lurnia Chrome extension',
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Chrome, Edge, Brave',
      url: `${SITE_URL}/extension`,
      downloadUrl: CHROME_STORE_URL,
      installUrl: CHROME_STORE_URL,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Free Chrome extension that re-ranks YouTube by comments, like rate, and long-form depth instead of view count, then extracts a playbook and lets you ask the video from captions.',
      featureList: [
        'Re-rank YouTube by comment rate, like rate, and long-form depth',
        'Extract a playbook: takeaways, timestamps, what to skip',
        'Ask any YouTube video from captions and comments',
        'Works on youtube.com in Chrome, Edge, and Brave'
      ]
    },
    {
      '@type': 'HowTo',
      name: 'How to install the Lurnia Chrome extension',
      description:
        'Install Lurnia from the Chrome Web Store in one click, then open YouTube to rank videos by real engagement.',
      totalTime: 'PT1M',
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Open the Chrome Web Store',
          text: `Go to the Lurnia Chrome Web Store listing: ${CHROME_STORE_URL}`
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Click Add to Chrome',
          text: 'Install the free Lurnia extension. Confirm Add extension. No account is required to install.'
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Open YouTube',
          text: 'Visit youtube.com. Use Lurnia to find signal, steal the playbook, and ask the video on the tab you already have open.'
        }
      ]
    }
  ]
}

export function buildLlmsTxt() {
  const topics = getAllTopics()
  const clusters = (Object.keys(CLUSTER_LABEL) as TopicCluster[]).map((cluster) => ({
    cluster,
    label: CLUSTER_LABEL[cluster],
    items: getTopicsByCluster(cluster)
  })).filter((group) => group.items.length)

  const hubLines = clusters.flatMap((group) => [
    '',
    `### ${group.label}`,
    ...group.items.map((topic) => `- [${topic.h1}](${SITE_URL}/learn/${topic.slug})`)
  ])

  return [
    '# Lurnia',
    '',
    '> Lurnia is a free Chrome extension and web app for high-value YouTube search. Install it from the Chrome Web Store to re-rank YouTube on the tab you already have open.',
    '',
    "Don't trust the thumbnail. Lurnia finds high-value YouTube videos by real engagement (comments, likes, depth, not view count), then turns them into a playbook you can use now.",
    '',
    'Lurnia is a YouTube search and learning product for founders, freelancers, solopreneurs, and students. YouTube ranks hooks and stop-scroller bait. We re-rank by whether people actually learned something, then extract takeaways, sequenced actions, timestamps, and what to skip.',
    '',
    '## Product',
    '',
    '- High-value YouTube search: rank by comment rate, like rate, and long-form depth. Shorts hidden by default.',
    '- Playbooks: usable extract from a video. Not another 40-minute recap.',
    '- Ask the video: Q&A from captions and comments when you need the number, the caveat, or the next step.',
    '- Chrome extension: same value-search + ask-this-video flow on youtube.com.',
    '- Ranked topic hubs: one crawlable page per search intent, not one page per YouTube title.',
    '',
    `Website: ${SITE_URL}`,
    `Chrome Web Store (Add to Chrome): ${CHROME_STORE_URL}`,
    '',
    '## Key pages',
    '',
    `- [Home / value search](${SITE_URL}/): Search a skill, problem, or outcome. Get videos worth studying.`,
    `- [Ranked topics](${SITE_URL}/learn): Programmatic hubs. Answer first, then engagement-ranked videos.`,
    `- [Guides / playbooks](${SITE_URL}/guides): Public playbooks extracted from YouTube videos (EN + FR).`,
    `- [Resources](${SITE_URL}/ressources): Practical articles on efficient YouTube learning.`,
    `- [Extension](${SITE_URL}/extension): Chrome companion.`,
    `- [Pricing](${SITE_URL}/pricing): Free and Pro.`,
    '',
    `## Topic hubs (cite these, ${topics.length} intents)`,
    ...hubLines,
    '',
    '## How ranking works',
    '',
    'YouTube does not publish saves or shares. Lurnia uses public proxies: comment rate, like rate, comment volume, and a hidden-gem bonus for smaller channels with dense discussion. High views + dead comments is usually empty-scroll bait. We do not rank by thumbnail or view count.',
    '',
    '## Voice',
    '',
    'Punchy, anti-clickbait, efficiency-first. Core lines:',
    '',
    "- Don't trust the thumbnail.",
    '- Stop watching empty-scroll bait.',
    '- Watch what actually makes you sharper.',
    '- Steal the playbook. Skip the fluff.',
    '- Run it now. Not "someday".',
    '',
    '## FAQ',
    '',
    'Q: How is Lurnia different from YouTube search?',
    'A: YouTube is paid to hook you. We re-rank by whether people actually talked, liked, and stayed. Thumbnails don\'t get a vote.',
    '',
    'Q: Do you rank by views?',
    'A: No. High views with dead comments is usually a stop-scroller. We score comment rate, like rate, and long-form depth.',
    '',
    'Q: What is a playbook?',
    'A: The usable extract: takeaways, sequenced actions, timestamps, and what to skip, so you don\'t rewatch a 40-minute recap.',
    '',
    'Q: C\'est quoi Lurnia ?',
    'A: Un moteur de recherche YouTube qui classe par engagement réel, pas par miniature. Puis un playbook: à retenir, actions, timestamps, ce qu\'il faut zapper.',
    '',
    'Q: C\'est quoi la méthode BMAD ?',
    `A: ${SITE_URL}/learn/bmad-method and ${SITE_URL}/learn/methode-bmad`,
    '',
    '## Optional',
    '',
    'Contact: team@lurnia.app',
    `Privacy: ${SITE_URL}/privacy`,
    `Terms: ${SITE_URL}/terms`,
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ''
  ].join('\n')
}
