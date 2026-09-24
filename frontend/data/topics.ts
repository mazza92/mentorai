export type TopicLang = 'en' | 'fr'
export type TopicCluster = 'outcome' | 'product' | 'coding-ai' | 'seo' | 'business'

export type TopicFaq = { q: string; a: string }

export type Topic = {
  slug: string
  lang: TopicLang
  cluster: TopicCluster
  /** YouTube query we rank. Not the SERP title. */
  query: string
  h1: string
  title: string
  description: string
  /** Answer-first block for Google + ChatGPT/Perplexity citations. */
  definition: string
  howWeRank: string
  faqs: TopicFaq[]
  related: string[]
  /** Same intent in the other language. Drives hreflang. */
  twin?: string
}

export const CLUSTER_LABEL: Record<TopicCluster, string> = {
  outcome: 'Get something done',
  product: 'Watch smarter',
  'coding-ai': 'AI coding, without the hook',
  seo: 'SEO, avis francs',
  business: 'Business, pas le bait'
}

/**
 * Programmatic SEO/GEO catalog.
 * One hub per search intent (skill, entity, comparison). Not one page per YouTube title.
 * Add a row here = a crawlable /learn/[slug] page, sitemap entry, and llms.txt link.
 */
export const TOPICS: Topic[] = [
  {
    slug: 'freelance-pricing',
    lang: 'en',
    cluster: 'outcome',
    query: 'freelance pricing how to price your services',
    h1: 'Freelance pricing videos worth studying',
    title: 
      
      
      "GitHub Spec Kit: AI coding playbook",
    description:
      
      
      
      "Don't trust the thumbnail. This page ranks the best videos about GitHub Spec Kit, focusing on practical applications and skipping the clickbait.",
    definition:
      
      
      
      "GitHub Spec Kit is a spec-first workflow for AI coding: write the contract, then let the model implement. YouTube videos often overpromise or lack depth. This page curates and ranks the most valuable content.",
    howWeRank:
      'We start from relevant videos, then score comment rate, like rate, and long-form depth. Shorts stay hidden. High views with dead comments usually means a stop-scroller.',
    faqs: [
      { q: "What is GitHub Spec Kit?", a: "GitHub Spec Kit is a methodology for AI-assisted coding where you define the software's specifications first, and then an AI model generates the code based on those specs. It's about contract-first development with AI." },
      { q: "Why should I use GitHub Spec Kit?", a: "It helps ensure that the AI-generated code meets your exact requirements by focusing on clear specifications upfront. This can lead to more reliable and predictable AI coding outcomes, reducing rework and improving code quality." }
    ],
    related: ['cold-email', 'validate-saas-idea', 'time-blocking']
  },
  {
    slug: 'cold-email',
    lang: 'en',
    cluster: 'outcome',
    query: 'cold email that books meetings',
    h1: 'Cold email that books. Not inbox bait.',
    title: 'Cold email videos ranked by real replies',
    description:
      "Don't trust the thumbnail. Cold email tutorials ranked by discussion and likes, then a playbook you can send now.",
    definition:
      'Cold email that books is a short, specific ask to a stranger with a reason to reply. Viral videos sell "45% reply rate" templates that die in spam. The useful ones show subject lines, first lines, follow-ups, and the offer. We rank those by comments and likes vs views, then extract the sequence.',
    howWeRank:
      'Relevance first, then comment rate, like rate, and depth. If nobody argued in the comments, it probably did not book anything.',
    faqs: [
      { q: 'What makes a cold email actually book?', a: 'A clear who, a specific reason, one ask, and a follow-up. Playbooks from high-discussion videos beat generic "value first" recaps.' },
      { q: 'Do you include Shorts?', a: 'No, unless you turn them on. Stop-scroll hooks rarely teach a sendable sequence.' }
    ],
    related: ['freelance-pricing', 'validate-saas-idea', 'time-blocking']
  },
  {
    slug: 'learn-sql',
    lang: 'en',
    cluster: 'outcome',
    query: 'learn SQL for data jobs tutorial',
    h1: 'SQL for a real job, not a 10-hour recap',
    title: 'Learn SQL: high-value videos, not bait',
    description:
      "Don't trust the thumbnail. SQL tutorials ranked by discussion and depth, so you practice what hiring actually tests.",
    definition:
      'SQL for a data job means SELECT, JOINs, GROUP BY, window functions, and messy real tables. Mega-view "SQL in 4 hours" videos often skip the parts interviews and dashboards use. We rank videos where people ask follow-up questions in the comments, then turn them into a playbook you can run now.',
    howWeRank:
      'Long-form depth plus comment rate. A 90k lecture with dense comments beats an 8M recap with a dead thread.',
    faqs: [
      { q: 'What SQL should I learn first for a job?', a: 'Filtering, joins, aggregations, then window functions on messy data. Skip the 40-minute history of databases.' },
      { q: 'How is this different from YouTube search?', a: 'YouTube sorts by what hooked people. We sort by whether they stayed and talked.' }
    ],
    related: ['time-blocking', 'methode-infaillible-apprendre', 'youtube-without-clickbait']
  },
  {
    slug: 'validate-saas-idea',
    lang: 'en',
    cluster: 'outcome',
    query: 'validate a SaaS idea before building',
    h1: 'Validate a SaaS idea before you build bait',
    title: 'Validate a SaaS idea: ranked playbooks',
    description:
      "Don't trust the thumbnail. Videos on validating a SaaS idea, ranked by real engagement, with the steps you can run now.",
    definition:
      'Validating a SaaS idea means proving someone will pay before you ship a 6-month build. Thumbnail culture sells "I made $10k MRR" origin stories. Useful videos show interviews, landing-page tests, waitlists, and what to kill. We rank by discussion, then extract the sequence.',
    howWeRank:
      'Comment rate and like rate vs views. Hidden gems (smaller channels, dense comments) often beat mega-viral founder recaps.',
    faqs: [
      { q: 'How do I validate a SaaS idea fast?', a: 'Talk to buyers, put a price on a page, try to get a yes. Steal the script from high-discussion videos, skip the lifestyle intro.' },
      { q: 'Should I watch build-in-public vlogs?', a: 'Only if comments show people used the method. We bury empty-scroll founder diaries.' }
    ],
    related: ['freelance-pricing', 'cold-email', 'creer-agents-ia']
  },
  {
    slug: 'time-blocking',
    lang: 'en',
    cluster: 'outcome',
    query: 'time blocking for solopreneurs',
    h1: 'Time blocking for people who actually ship',
    title: 'Time blocking: videos that are not fluff',
    description:
      "Don't trust the thumbnail. Time-blocking videos ranked by comments and depth, then a playbook you can run now.",
    definition:
      'Time blocking is putting real work on a calendar so deep work happens, not just meetings. Productivity YouTube is full of aesthetic setups and 5am routines. The useful videos show a weekly template, what to batch, and what to refuse. We rank those by engagement, then tell you what to skip.',
    howWeRank:
      'Long-form plus comment rate. If the comments are just "so true", it is usually bait. If people argue about calendars, it is signal.',
    faqs: [
      { q: 'Does time blocking work for solopreneurs?', a: 'Yes if you protect maker hours and batch admin. Playbooks from high-discussion videos beat morning-routine recaps.' },
      { q: 'What should I skip?', a: 'The 40-minute origin story, the app tour, and any "watch my day" montage.' }
    ],
    related: ['freelance-pricing', 'cold-email', 'youtube-without-clickbait']
  },
  {
    slug: 'youtube-without-clickbait',
    lang: 'en',
    cluster: 'product',
    query: 'best educational YouTube videos not clickbait',
    h1: "Don't trust the thumbnail. Watch what taught people.",
    title: 'YouTube without clickbait: ranked by value',
    description:
      'YouTube ranks hooks. Lurnia ranks videos people actually learned from: comments, likes, depth. Then a playbook.',
    definition:
      'Clickbait YouTube is a thumbnail and title designed to stop the scroll, with a video that does not pay off. High-value YouTube is the opposite: people comment, like, and stay because they learned something. Lurnia re-ranks search by those signals, hides Shorts by default, and turns the pick into a playbook you can use now.',
    howWeRank:
      'Comment rate, like rate, log comment volume, long-form (about 8 to 45 min), plus a hidden-gem bonus for smaller channels with dense discussion. Not view count. Not the thumbnail.',
    faqs: [
      { q: 'How do you find YouTube videos that are not clickbait?', a: 'Search a skill or outcome, then sort by comments and likes vs views. Dead comments on a huge view count is usually a stop-scroller.' },
      { q: 'Do you use saves or shares?', a: 'YouTube does not publish those. Comments and likes vs views are the public proxies.' }
    ],
    related: ['high-value-youtube-videos', 'fabrique-a-idiots', 'bmad-method']
  },
  {
    slug: 'high-value-youtube-videos',
    lang: 'en',
    cluster: 'product',
    query: 'high value YouTube tutorials comments likes',
    h1: 'High-value YouTube videos, ranked honestly',
    title: 'High-value YouTube videos: not view count',
    description:
      "Don't trust the thumbnail. Find YouTube videos with real discussion and depth, then steal the playbook.",
    definition:
      'A high-value YouTube video is one people actually used: they commented, liked, and asked follow-ups. View count only proves the hook worked. Lurnia searches relevant videos, scores engagement density, and opens a playbook (takeaways, timestamps, what to skip) so you do not rewatch a recap.',
    howWeRank:
      'Same scoring as the product: comments and likes vs views, long-form depth, hidden gems included, Shorts off unless you ask.',
    faqs: [
      { q: 'What is a high-value YouTube video?', a: 'One with dense discussion relative to views, enough length to teach, and a playbook you can run now. Not a stop-scroller.' },
      { q: 'Can I ask the video questions?', a: 'Yes. Open a result and ask for the number, the caveat, or the next step. Answers come from captions and comments.' }
    ],
    related: ['youtube-without-clickbait', 'fabrique-a-idiots', 'learn-sql']
  },
  {
    slug: 'bmad-method',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'BMAD method AI coding',
    h1: 'BMAD method: what it is, without the hook',
    title: 'BMAD method explained: playbook, not bait',
    description:
      "What is BMAD? Don't trust the YouTube title. Ranked videos, steps, and what to skip.",
    definition:
      'BMAD is an AI coding workflow people search as "bmad method" or "c\'est quoi BMAD": split work into agent-style roles, write the spec before the code, then implement. Viral videos call it the ultimate system and skip the loop. We rank the videos with real questions in the comments, then extract the steps you can run now.',
    howWeRank:
      'Entity query first (BMAD, not generic AI coding), then comment rate over views. Definitional FAQs sit on this page so Google and ChatGPT can cite a straight answer.',
    faqs: [
      { q: 'What is the BMAD method?', a: 'A structured AI coding setup: break the job into roles, specify before you generate, then implement. Use a high-discussion playbook, not a 40-minute recap.' },
      { q: 'Is BMAD just vibe coding?', a: 'No. The point is more spec and less blind generation. If a video never shows the spec step, skip it.' }
    ],
    related: ['methode-bmad', 'github-spec-kit', 'cursor-context-engineering', 'qwen-vs-claude'],
    twin: 'methode-bmad'
  },
  {
    slug: 'methode-bmad',
    lang: 'fr',
    cluster: 'coding-ai',
    query: 'méthode BMAD IA c’est quoi',
    h1: 'Méthode BMAD: c’est quoi, sans le hook',
    title: 'Méthode BMAD: c’est quoi + playbook',
    description:
      'C’est quoi BMAD ? Ne te fie pas à la miniature. Vidéos classées par vraie discussion, étapes, ce qu’il faut zapper.',
    definition:
      'La méthode BMAD est un workflow de code avec l’IA: découper le travail en rôles, écrire la spec avant le code, puis implémenter. Les gens cherchent "c’est quoi BMAD" et "bmad method" parce que les miniatures crient "système ultime" et zappent la boucle. On classe les vidéos où les commentaires posent de vraies questions, puis on en sort un playbook à exécuter maintenant.',
    howWeRank:
      'Requête entité (BMAD), puis taux de commentaires et de likes, pas le brut de vues. Cette page existe pour les requêtes définitionnelles déjà vues dans Google Search Console.',
    faqs: [
      { q: 'C’est quoi la méthode BMAD ?', a: 'Un setup de coding IA structuré: rôles, spec, puis code. Prends le playbook d’une vidéo à forte discussion, pas le récap viral.' },
      { q: 'BMAD vs vibe coding ?', a: 'BMAD pousse la spec. Si la vidéo ne montre jamais la spec, c’est du bait.' }
    ],
    related: ['bmad-method', 'github-spec-kit', 'protocole-a2a'],
    twin: 'bmad-method'
  },
  {
    slug: 'qwen-vs-claude',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'Qwen vs Claude Code difference',
    h1: 'Qwen vs Claude Code: keep this, skip that',
    title: 'Qwen vs Claude Code: ranked, not the hook',
    description:
      "Don't trust the thumbnail. What actually changed between Qwen and Claude Code, from videos people discussed.",
    definition:
      'Qwen vs Claude Code is a model-and-tooling comparison: when Qwen is enough, when Claude Code still wins, and what to switch. Search Console already shows "différence entre qwen et claude" with zero clicks on dumped YouTube titles. This hub answers the comparison, then lists engagement-ranked videos and playbooks.',
    howWeRank:
      'Comparison query, then comment rate. We want arguments in the comments, not a thumbnail that says "I quit Claude".',
    faqs: [
      { q: 'What is the difference between Qwen and Claude Code?', a: 'Qwen is often cheaper and fast for local or open workflows. Claude Code still leads on hard repo tasks for many people. Watch a high-discussion comparison, skip the rage-quit intro.' },
      { q: 'Should I switch?', a: 'Switch for a job type, not a thumbnail. Open the playbook for the caveat, then try one task now.' }
    ],
    related: ['claude-code-vs-cursor', 'claude-code-mcp', 'cursor-context-engineering']
  },
  {
    slug: 'cursor-context-engineering',
    lang: 'en',
    cluster: 'coding-ai',
    query: "Cursor context engineering how the 1% build apps",
    h1: 'Cursor context engineering, without the 1% myth',
    title: 'Cursor context engineering: the real method',
    description:
      "Don't trust the thumbnail. How people actually brief Cursor: context, PRD, what to skip. Ranked by discussion.",
    definition:
      'Context engineering in Cursor means feeding the model the right files, rules, and PRD so it ships instead of hallucinating. GSC shows the exact YouTube title as a query with 0% CTR. This page answers the intent, then ranks videos by engagement instead of reprinting the clickbait title.',
    howWeRank:
      'Match the skill (context, PRD, rules), bury the "how the 1% live" storytelling, keep long-form with dense comments.',
    faqs: [
      { q: 'What is Cursor context engineering?', a: 'Putting specs, rules, and the right files in context before you generate. Not a personality video about the 1%.' },
      { q: 'Where do I start now?', a: 'Open the top-ranked playbook, copy the context setup, skip the origin story.' }
    ],
    related: ['github-spec-kit', 'claude-code-vs-cursor', 'claude-code-mcp']
  },
  {
    slug: 'tempo-labs',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'Tempo Labs tutorial vibe coding',
    h1: 'Tempo Labs: what actually ships',
    title: 'Tempo Labs tutorial: skip the vibe bait',
    description:
      "Don't trust the thumbnail. Tempo Labs videos ranked by real discussion: what ships, timestamps, what to skip.",
    definition:
      'Tempo Labs is a vibe-coding / AI app-building tool. Search dumps the full YouTube title into Google and nobody clicks, because the SERP looks like a video, not an answer. This hub says what Tempo Labs is for, ranks the tutorials people actually talked about, and links playbooks.',
    howWeRank:
      'Brand + tutorial intent, then comment rate. "Ultimate package" thumbnails with dead comments go down.',
    faqs: [
      { q: 'What is Tempo Labs?', a: 'An AI app-building environment people use for fast UI and vibe coding. Use a high-discussion tutorial, not the 8-word hook.' },
      { q: 'Is vibe coding enough?', a: 'Only if you still specify the outcome. Pair with a playbook: steps now, fluff skipped.' }
    ],
    related: ['cursor-context-engineering', 'bmad-method', 'claude-code-mcp']
  },
  {
    slug: 'claude-code-mcp',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'Claude Code MCP Cursor setup tutorial',
    h1: 'Claude Code + MCP + Cursor: setup that works',
    title: 'Claude Code MCP setup: playbook, skip fluff',
    description:
      "Don't trust the thumbnail. Claude Code, MCP, and Cursor setup videos ranked by discussion, not view count.",
    definition:
      'Claude Code plus MCP plus Cursor is a setup: the CLI or IDE agent, Model Context Protocol servers, and Cursor as the editor. Most tutorials pad 40 minutes of install theater. We rank the ones people asked follow-ups on, then extract the sequence you can run now.',
    howWeRank:
      'Setup intent, long-form depth, comment rate. Sponsor-heavy recaps with dead comments drop.',
    faqs: [
      { q: 'How do I set up Claude Code with MCP and Cursor?', a: 'Install, connect MCP servers you actually need, then one real task. Steal the order from a high-discussion playbook.' },
      { q: 'What should I skip?', a: 'The life story, the five unused MCP servers, and the "watch me click" padding.' }
    ],
    related: ['claude-agentic-browser', 'earn-with-claude-code', 'claude-code-vs-cursor']
  },
  {
    slug: 'linkuma-avis',
    lang: 'fr',
    cluster: 'seo',
    query: 'Linkuma avis tutoriel backlinks',
    h1: 'Linkuma avis: le tuto, pas la miniature',
    title: 'Linkuma avis + tuto backlinks pas chers',
    description:
      'Ne te fie pas à la miniature. Avis franc sur Linkuma, tuto backlinks, et ce qu’il faut zapper. Vidéos classées par discussion.',
    definition:
      'Linkuma est une plateforme de netlinking / backlinks low cost. Dans Google Search Console, "linkuma tutoriel" fait plus de 3 000 impressions sur une page au titre YouTube brut, avec 0% de clics. Cette page répond à l’intention avis + tuto, classe les vidéos par engagement réel, et ouvre un playbook.',
    howWeRank:
      'Intention "avis / tuto / backlinks pas chers", puis taux de commentaires. On enterre le bait "deviens 1er sur Google".',
    faqs: [
      { q: 'Linkuma, c’est quoi ?', a: 'Un réseau de backlinks / articles pour le netlinking, souvent visé "pas cher". Lis un avis à forte discussion, pas la miniature.' },
      { q: 'Linkuma vaut-il le coup ?', a: 'Ça dépend du site, du budget, et du risque. Le playbook doit donner le caveat, pas un hype de 40 minutes.' }
    ],
    related: ['haloscan-avis', 'etf-ia-pea-2026', 'youtube-without-clickbait']
  },
  {
    slug: 'etf-ia-pea-2026',
    lang: 'fr',
    cluster: 'business',
    query: 'meilleurs ETF IA éligibles PEA 2026',
    h1: 'ETF IA éligibles PEA 2026: le top utile',
    title: 'ETF IA éligibles PEA 2026: pas le hook',
    description:
      'Ne te fie pas à la miniature. ETF et actions IA éligibles PEA 2026, classés par vraie discussion, avec caveats.',
    definition:
      'Les ETF IA éligibles PEA sont des trackers d’intelligence artificielle que tu peux loger dans un PEA français. Les requêtes "meilleurs ETF IA éligibles PEA 2026" et "meilleures actions IA" impressionnent déjà, sans clic, parce que le titre SERP est un titre YouTube. Ici: la question, les caveats, puis les vidéos à forte discussion.',
    howWeRank:
      'Requête finance précise, format long, commentaires denses. On descend les miniatures "deviens riche avec l’IA".',
    faqs: [
      { q: 'Quels ETF IA sont éligibles au PEA ?', a: 'La liste bouge. Prends une vidéo à forte discussion qui cite les tickers et les limites, puis vérifie chez ton courtier maintenant.' },
      { q: 'C’est un conseil en investissement ?', a: 'Non. C’est un classement de contenus. Les playbooks extraient chiffres et caveats, pas une promesse de rendement.' }
    ],
    related: ['linkuma-avis', 'dropshipping-shopify-ia', 'validate-saas-idea']
  },
  {
    slug: 'dropshipping-shopify-ia',
    lang: 'fr',
    cluster: 'business',
    query: 'dropshipping 2.0 Shopify IA boutique',
    h1: 'Dropshipping 2.0 Shopify: ce qui reste vrai',
    title: 'Dropshipping Shopify IA: playbook, pas hook',
    description:
      'Ne te fie pas à la miniature. Dropshipping 2.0 + Shopify + IA: vidéos classées par discussion, ce qui est du bait.',
    definition:
      'Le dropshipping 2.0, c’est une boutique Shopify (souvent avec IA) où le pitch YouTube promet "boutique en 24h". Les vues sont énormes, les commentaires utiles sont rares. On classe par engagement réel, puis on extrait offre, stack, et ce qu’il faut zapper, à exécuter maintenant si ça tient encore.',
    howWeRank:
      'Intention boutique / Shopify / IA, puis likes et commentaires vs vues. Les "deviens millionnaire" avec thread mort descendent.',
    faqs: [
      { q: 'Le dropshipping 2.0 marche encore ?', a: 'Parfois, avec une offre nette et du paid/organic réel. Les playbooks à forte discussion le montrent. Les miniatures, non.' },
      { q: 'Shopify + IA, par où commencer ?', a: 'Une offre, une page, un test. Ouvre le résultat #1 classé, saute l’intro lifestyle.' }
    ],
    related: ['yomi-denzel-shopify', 'creer-agents-ia', 'yassine-sdiri-formation']
  },
  {
    slug: 'creer-agents-ia',
    lang: 'fr',
    cluster: 'business',
    query: 'créer et vendre des agents IA de A à Z',
    h1: 'Créer et vendre des agents IA: le playbook',
    title: 'Créer et vendre des agents IA: pas le bait',
    description:
      'Ne te fie pas à la miniature. Agents IA de A à Z: offre, stack, vente. Vidéos classées par vraie discussion.',
    definition:
      'Créer et vendre des agents IA, c’est packager un workflow (support, prospection, ops) et le vendre, pas juste démo ChatGPT. YouTube vend "agent en 10 min". Les commentaires utiles parlent stack, clients, prix. On classe là-dessus, puis on sort les étapes à lancer maintenant.',
    howWeRank:
      'Intention création + vente, format long, taux de commentaires. On enterre les démos sans offre.',
    faqs: [
      { q: 'Comment vendre un agent IA ?', a: 'Une offre pour un job précis, une démo, un prix. Vole la séquence d’une vidéo à forte discussion.' },
      { q: 'Par où commencer maintenant ?', a: 'Un use case, un outil, un premier client. Skip le tour de 12 autohubs.' }
    ],
    related: ['yassine-sdiri-formation', 'earn-with-claude-code', 'openclaw']
  },
  {
    slug: 'earn-with-claude-code',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'earn money with Claude Code apps',
    h1: 'Earn with Claude Code, without the $ hook',
    title: 'Earn with Claude Code apps: 3 real plays',
    description:
      "Don't trust the thumbnail. Three ways to earn with Claude Code: actions, caveats, timestamps. Not a 40-minute recap.",
    definition:
      'Earning with Claude Code means shipping a small paid app, a freelance workflow, or an internal tool people will pay for. Not a thumbnail that screams "$10k/month". GSC already shows the dumped YouTube title with almost no clicks. This hub answers what actually sold, then ranks videos by discussion and hands you a playbook.',
    howWeRank:
      'Monetization intent, then comment rate. We want people arguing about what they charged, not a lifestyle intro.',
    faqs: [
      { q: 'Can you actually earn money with Claude Code?', a: 'Yes if you sell a finished job: an app, a workflow, a client deliverable. Playbooks from high-discussion videos beat "I quit my job" recaps.' },
      { q: 'What should I skip?', a: 'The revenue flex, the 20-minute setup tour, and any promise without a price or an offer.' }
    ],
    related: ['claude-code-mcp', 'claude-code-vs-cursor', 'creer-agents-ia']
  },
  {
    slug: 'fabrique-a-idiots',
    lang: 'fr',
    cluster: 'product',
    query: 'la fabrique à idiots micode résumé',
    h1: 'La Fabrique à idiots: le résumé utile',
    title: 'La Fabrique à idiots (Micode): le playbook',
    description:
      "Ne te fie pas à la miniature. Résumé utile de La Fabrique à idiots: thèses, timestamps, ce qu'il faut zapper.",
    definition:
      'La Fabrique à idiots est un documentaire Micode sur la bêtise en ligne, les algorithmes, et ce que ça fabrique. Les gens cherchent "résumé" parce que la vidéo est longue et le titre Google est un dump YouTube. Ici: les thèses, les caveats, les timestamps, puis les vidéos à forte discussion. Pas un recap mou.',
    howWeRank:
      'Requête entité (Micode / Fabrique à idiots), format long, commentaires denses. On descend les extraits clickbait.',
    faqs: [
      { q: 'C’est quoi La Fabrique à idiots ?', a: 'Un documentaire Micode sur comment le web récompense la bêtise. Prends le playbook: thèses, preuves, ce qu’il faut zapper.' },
      { q: 'Pourquoi un hub plutôt que la vidéo brute ?', a: 'Parce que le SERP recolle le titre YouTube et personne ne clique. On répond d’abord, puis on classe.' }
    ],
    related: ['youtube-without-clickbait', 'high-value-youtube-videos', 'methode-infaillible-apprendre']
  },
  {
    slug: 'google-a2a-protocol',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'Google A2A protocol explained tutorial',
    h1: 'Google A2A protocol, without the keynote',
    title: 'Google A2A protocol: tutorial, skip fluff',
    description:
      "Don't trust the thumbnail. What A2A actually is, how agents talk, the demo worth watching, what to skip.",
    definition:
      'Google A2A (Agent-to-Agent) is a protocol so AI agents can talk to each other across tools. Search dumps "protocol explained tutorial demo how it works" into Google with almost no clicks. This hub defines A2A in plain language, then ranks the tutorials people actually asked about.',
    howWeRank:
      'Entity + tutorial intent, then comment rate. Keynote recaps with dead comments drop.',
    faqs: [
      { q: 'What is the Google A2A protocol?', a: 'A way for AI agents to request work from other agents, not just call an API. Steal the sequence from a high-discussion tutorial.' },
      { q: 'Do I need A2A today?', a: 'Only if you are wiring multiple agents. If a video never shows a real handshake, skip it.' }
    ],
    related: ['protocole-a2a', 'claude-code-mcp', 'github-spec-kit'],
    twin: 'protocole-a2a'
  },
  {
    slug: 'protocole-a2a',
    lang: 'fr',
    cluster: 'coding-ai',
    query: 'tutoriel protocole A2A Google agents',
    h1: 'Protocole A2A Google: c’est quoi, sans le keynote',
    title: 'Protocole A2A: tuto, pas le dump YouTube',
    description:
      'Ne te fie pas à la miniature. C’est quoi A2A, comment les agents se parlent, le tuto utile, ce qu’il faut zapper.',
    definition:
      'Le protocole A2A de Google, c’est un standard pour que des agents IA se parlent entre outils. Dans GSC, "tutoriel protocole a2a" impressionne déjà, avec 0% de clics, parce que le SERP recopie un titre YouTube. Cette page répond, puis classe les tutos par vraie discussion.',
    howWeRank:
      'Requête entité + tuto, puis taux de commentaires. Les recaps keynote sans questions descendent.',
    faqs: [
      { q: 'C’est quoi le protocole A2A ?', a: 'Un handshake entre agents IA. Prends un tuto à forte discussion, pas le keynote de 40 minutes.' },
      { q: 'J’en ai besoin maintenant ?', a: 'Seulement si tu branches plusieurs agents. Si la vidéo ne montre jamais l’échange, zapper.' }
    ],
    related: ['google-a2a-protocol', 'methode-bmad', 'openclaw'],
    twin: 'google-a2a-protocol'
  },
  {
    slug: 'github-spec-kit',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'GitHub Spec Kit AI coding tutorial',
    h1: 'GitHub Spec Kit: spec first, then generate',
    title: 'GitHub Spec Kit: AI coding playbook',
    description:
      "Don't trust the thumbnail. Spec Kit for AI coding: what it fixes, the loop, timestamps, what to skip.",
    definition:
      'GitHub Spec Kit is a spec-first workflow for AI coding: write the contract, then let the model implement. Viral titles say it "finally fixed AI coding". Useful videos show the files, the loop, and where it still fails. We rank those by discussion, then extract the sequence.',
    howWeRank:
      'Brand + method intent, then comment rate. Pair it with BMAD: more spec, less vibe.',
    faqs: [
      { q: 'What is GitHub Spec Kit?', a: 'A spec-first kit so the model implements a contract instead of guessing. Open a high-discussion playbook, skip the "finally fixed" hook.' },
      { q: 'Is this the same as BMAD?', a: 'Same family: specify before you generate. Spec Kit is a GitHub-shaped kit. BMAD is the role split. Use both hubs, do not mash the titles.' }
    ],
    related: ['bmad-method', 'cursor-context-engineering', 'claude-code-mcp']
  },
  {
    slug: 'claude-agentic-browser',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'Claude agentic browser Anthropic tutorial',
    h1: 'Claude agentic browser: what it actually does',
    title: 'Claude agentic browser: playbook, not hype',
    description:
      "Don't trust the thumbnail. Claude's agentic browser: what it can click, the limits, timestamps, what to skip.",
    definition:
      'Claude’s agentic browser is Anthropic letting Claude use a computer: click, type, browse, complete a task. Search already shows "claude browser", "agent browser claude", "claude ai browser" with almost no clicks on dumped titles. This hub says what it is, what it is not, then ranks tutorials by real questions in the comments.',
    howWeRank:
      'Setup and demo intent, then comment rate. We bury "it will replace your job" thumbnails with dead threads.',
    faqs: [
      { q: 'What is the Claude agentic browser?', a: 'Claude controlling a browser to finish a task, not a new Chrome skin. Steal the first real task from a high-discussion playbook.' },
      { q: 'Is it safe to let it click around?', a: 'Treat it like an intern with your mouse. The playbook should show the caveat, not just the wow demo.' }
    ],
    related: ['claude-code-mcp', 'openclaw', 'earn-with-claude-code']
  },
  {
    slug: 'haloscan-avis',
    lang: 'fr',
    cluster: 'seo',
    query: 'Haloscan avis tuto code promo',
    h1: 'Haloscan avis: le tuto, pas le code promo',
    title: 'Haloscan avis + tuto, pas le bait',
    description:
      'Ne te fie pas à la miniature. Avis franc sur Haloscan, tuto, caveats, et ce qu’il faut zapper. Vidéos classées par discussion.',
    definition:
      'Haloscan est un outil SEO (souvent visé SERP / questions / data). Dans GSC, "haloscan avis", "code promo haloscan" et le titre YouTube brut impressionnent, avec 0% de clics. Cette page répond avis + tuto, classe les vidéos par engagement, et ouvre un playbook. Le code promo n’est pas le produit.',
    howWeRank:
      'Intention avis / tuto, puis taux de commentaires. On descend les miniatures "code promo" sans test réel.',
    faqs: [
      { q: 'Haloscan, c’est quoi ?', a: 'Un outil SEO autour des questions et de la SERP. Lis un avis à forte discussion, pas le titre sponsor.' },
      { q: 'Le code promo vaut-il le tuto ?', a: 'Non. Le playbook doit montrer ce que tu fais dans l’outil. Le code promo est un P.S., pas le sujet.' }
    ],
    related: ['linkuma-avis', 'youtube-without-clickbait', 'formation-chatgpt']
  },
  {
    slug: 'yassine-sdiri-formation',
    lang: 'fr',
    cluster: 'business',
    query: 'Yassine Sdiri formation IA avis',
    h1: 'Formation Yassine Sdiri: l’avis, pas le hook',
    title: 'Yassine Sdiri formation IA: avis utile',
    description:
      'Ne te fie pas à la miniature. Formation IA Yassine Sdiri: ce qu’elle couvre, les caveats, les vidéos à forte discussion.',
    definition:
      'Yassine Sdiri vend une formation / communauté IA. Les requêtes "yassine sdiri formation" impressionnent déjà, sans clic, parce que Google affiche un titre YouTube. Ici: c’est quoi l’offre, pour qui, ce que les commentaires contestent, puis les vidéos classées par vraie discussion. Pas un recap hype.',
    howWeRank:
      'Requête entité + avis, puis commentaires denses. On enterre les "deviens expert IA" sans programme.',
    faqs: [
      { q: 'La formation Yassine Sdiri vaut-elle le coup ?', a: 'Ça dépend de ton niveau et du programme actuel. Prends un avis à forte discussion, pas la miniature.' },
      { q: 'Par où commencer si je ne m’inscris pas ?', a: 'Un use case, un outil, un premier client. Le hub agents IA + le playbook classé #1 suffisent souvent.' }
    ],
    related: ['creer-agents-ia', 'formation-chatgpt', 'dropshipping-shopify-ia']
  },
  {
    slug: 'yomi-denzel-shopify',
    lang: 'fr',
    cluster: 'business',
    query: 'Yomi Denzel boutique Shopify dropshipping',
    h1: 'Yomi Denzel Shopify: ce qui reste vrai',
    title: 'Yomi Denzel Shopify: playbook, pas hook',
    description:
      'Ne te fie pas à la miniature. Boutique Shopify / dropshipping Yomi Denzel: méthode, caveats, ce qu’il faut zapper.',
    definition:
      'Yomi Denzel est cherché avec "boutique", "Shopify", "dropshipping". Ce n’est pas la même page que le hub dropshipping 2.0 générique: ici l’entité, l’offre, et ce que les commentaires contestent. GSC montre déjà ces requêtes sur des titres YouTube à 0% de clics. On répond, puis on classe.',
    howWeRank:
      'Requête entité + Shopify, puis likes et commentaires vs vues. Les "deviens millionnaire" avec thread mort descendent.',
    faqs: [
      { q: 'La méthode Yomi Denzel marche encore ?', a: 'Parfois, avec une offre nette et du paid réel. Les playbooks à forte discussion le montrent. Les miniatures, non.' },
      { q: 'Shopify ou une autre stack ?', a: 'Shopify est le default du pitch. Ouvre le résultat #1 classé, saute l’intro lifestyle, vérifie les frais.' }
    ],
    related: ['dropshipping-shopify-ia', 'creer-agents-ia', 'freelance-pricing']
  },
  {
    slug: 'openclaw',
    lang: 'fr',
    cluster: 'coding-ai',
    query: "c'est quoi OpenClaw IA",
    h1: 'OpenClaw: c’est quoi, sans le bruit',
    title: 'C’est quoi OpenClaw ? Playbook, pas hype',
    description:
      'Ne te fie pas à la miniature. C’est quoi OpenClaw, à quoi ça sert, ce que les commentaires contestent, ce qu’il faut zapper.',
    definition:
      'OpenClaw est un truc IA dont tout le monde parle et que personne n’explique clairement, d’où la requête. Le titre YouTube dumpé dans Google ne convertit pas. Cette page dit ce que c’est, ce que ça n’est pas, puis classe les vidéos par vraie discussion et sort un playbook.',
    howWeRank:
      'Requête définitionnelle, puis taux de commentaires. On descend les "personne n’en parle" qui parlent trop.',
    faqs: [
      { q: 'C’est quoi OpenClaw ?', a: 'Un projet / outil IA dont le pitch YouTube est plus fort que la spec. Lis un playbook à forte discussion, pas le hook.' },
      { q: 'Je dois m’y mettre maintenant ?', a: 'Seulement si le playbook montre un job précis. Sinon, BMAD + un vrai agent suffisent.' }
    ],
    related: ['creer-agents-ia', 'protocole-a2a', 'claude-agentic-browser']
  },
  {
    slug: 'claude-code-vs-cursor',
    lang: 'en',
    cluster: 'coding-ai',
    query: 'Claude Code vs Codex vs Cursor who wins',
    h1: 'Claude Code vs Cursor vs Codex: pick one job',
    title: 'Claude Code vs Cursor vs Codex: ranked',
    description:
      "Don't trust the thumbnail. Claude Code vs Cursor vs Codex: when each wins, the caveat, what to skip.",
    definition:
      'Claude Code vs Cursor vs Codex is a tooling comparison: CLI agent, IDE agent, OpenAI’s coding stack. Thumbnails pick a winner for the algorithm. Useful videos show a task, a miss, and when to switch. We rank those by argument-in-the-comments, then extract the playbook.',
    howWeRank:
      'Comparison query, then comment rate. "I quit X" intros with dead comments drop. Qwen vs Claude stays on its own hub.',
    faqs: [
      { q: 'Claude Code or Cursor?', a: 'Cursor for in-editor loops. Claude Code for long agent runs. Steal the split from a high-discussion comparison, not a rage-quit title.' },
      { q: 'Where does Codex fit?', a: 'When the job is OpenAI-shaped. The playbook should say the caveat. If a video never shows a failed task, skip it.' }
    ],
    related: ['qwen-vs-claude', 'claude-code-mcp', 'cursor-context-engineering']
  },
  {
    slug: 'methode-infaillible-apprendre',
    lang: 'fr',
    cluster: 'outcome',
    query: 'la méthode infaillible pour tout apprendre IA',
    h1: 'Tout apprendre avec l’IA: la méthode, pas le slogan',
    title: 'Méthode pour tout apprendre: pas le bait',
    description:
      'Ne te fie pas à la miniature. Méthode pour tout apprendre avec l’IA: boucle, pratique, ce qu’il faut zapper.',
    definition:
      '« La méthode infaillible pour tout apprendre » est un titre YouTube, pas une pédagogie. L’intention réelle: une boucle (but, source, pratique, rappel) que tu peux lancer maintenant. On classe les vidéos où les commentaires parlent d’application, puis on extrait le playbook. SQL, ChatGPT, et le time blocking restent des hubs à part.',
    howWeRank:
      'Intention apprendre + IA, format long, taux de commentaires. On descend les "cerveau illimité" avec thread mort.',
    faqs: [
      { q: 'Quelle méthode pour tout apprendre avec l’IA ?', a: 'Un but, une source dense, de la pratique, un rappel. Vole la boucle d’une vidéo à forte discussion.' },
      { q: 'Je commence par quelle compétence ?', a: 'Celle qui paie un job précis. SQL, une offre freelance, ou ChatGPT appliqué. Pas un tour de 12 apps.' }
    ],
    related: ['learn-sql', 'formation-chatgpt', 'time-blocking']
  },
  {
    slug: 'formation-chatgpt',
    lang: 'fr',
    cluster: 'outcome',
    query: 'formation ChatGPT comment utiliser 2025',
    h1: 'Formation ChatGPT: l’usage, pas le tour de magie',
    title: 'Formation ChatGPT: playbook, pas le dump',
    description:
      'Ne te fie pas à la miniature. Formation ChatGPT utile: prompts qui servent, limites, timestamps, ce qu’il faut zapper.',
    definition:
      'Une formation ChatGPT qui sert, c’est un usage (écrire, analyser, vendre), pas "comment utiliser ChatGPT en 2025" en titre YouTube. Cette requête impressionne déjà à 0% de clics. On répond: par où commencer, ce qui est du fluff, puis les vidéos classées par discussion réelle.',
    howWeRank:
      'Intention formation + usage, puis commentaires. Les "ChatGPT va tout changer" sans exercice descendent.',
    faqs: [
      { q: 'Par où commencer une formation ChatGPT ?', a: 'Un job (email, offre, analyse), 10 exemples, une limite. Playbook à forte discussion, pas le tour de l’interface.' },
      { q: 'C’est suffisant pour vendre de l’IA ?', a: 'Non. Couple avec le hub agents IA / formation Yassine si tu vends. ChatGPT seul n’est pas une offre.' }
    ],
    related: ['creer-agents-ia', 'yassine-sdiri-formation', 'methode-infaillible-apprendre']
  },
  {
    slug: 'figma-prototypage',
    lang: 'fr',
    cluster: 'outcome',
    query: 'tuto Figma prototyper un site one page',
    h1: 'Prototyper dans Figma, sans le recap 40 min',
    title: 'Tuto Figma prototypage: playbook, pas fluff',
    description:
      'Ne te fie pas à la miniature. Tuto Figma: prototyper un one-page, timestamps, ce qu’il faut zapper.',
    definition:
      'Prototyper dans Figma, c’est relier des frames pour tester un one-page avant de coder. GSC montre déjà "prototypage figma" et le tuto YouTube dumpé, avec peu de clics. Cette page dit la boucle (wire, prototype, share), classe les tutos par discussion, et ouvre un playbook à exécuter maintenant.',
    howWeRank:
      'Intention tuto + one-page, format long utile, taux de commentaires. On descend les "Figma from zero" de 2 heures.',
    faqs: [
      { q: 'Comment prototyper un site dans Figma ?', a: 'Frames, liaisons, preview, un vrai user test. Vole l’ordre d’un tuto à forte discussion.' },
      { q: 'Figma ou je code direct ?', a: 'Prototype si tu valides un flow. Code si le layout est déjà évident. Le playbook doit le dire, pas le thumbnail.' }
    ],
    related: ['cursor-context-engineering', 'tempo-labs', 'validate-saas-idea']
  }
]

const bySlug = new Map(TOPICS.map((topic) => [topic.slug, topic]))

export function getTopic(slug: string) {
  return bySlug.get(slug) || null
}

export function getAllTopics() {
  return TOPICS
}

export function getTopicsByLang(lang: TopicLang) {
  return TOPICS.filter((topic) => topic.lang === lang)
}

export function getRelatedTopics(topic: Topic) {
  return topic.related.map((slug) => bySlug.get(slug)).filter((item): item is Topic => Boolean(item))
}

export function getTopicsByCluster(cluster: TopicCluster) {
  return TOPICS.filter((topic) => topic.cluster === cluster)
}

export function getTwinTopic(topic: Topic) {
  return topic.twin ? bySlug.get(topic.twin) || null : null
}
