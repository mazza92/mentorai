import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ne te fie pas à la miniature | Playbooks YouTube',
  description:
    'YouTube classe les hooks. Ici: vidéos à forte discussion, playbooks, timestamps, et ce qu’il faut zapper. Ressources pour fondateurs, freelances, solopreneurs.',
  alternates: {
    canonical: 'https://lurnia.app/ressources'
  },
  openGraph: {
    title: 'Ne te fie pas à la miniature | Playbooks YouTube',
    description: 'Guides pour trouver du YouTube utile, extraire le playbook, et arrêter de perdre des heures sur du stop-scroll.',
    url: 'https://lurnia.app/ressources',
    type: 'website'
  }
}

export default function RessourcesLayout({ children }: { children: React.ReactNode }) {
  return children
}
