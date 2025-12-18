# Guide de Génération d'Images SEO pour Articles Lurnia

## 📐 Spécifications Techniques

### Dimensions & Formats

| Type | Dimensions | Format | Poids Max |
|------|-----------|--------|-----------|
| **Open Graph (OG)** | 1200×630px | JPG/PNG | 200KB |
| **Twitter Card** | 1200×600px | JPG/PNG | 200KB |
| **Article Hero** | 1920×1080px | WebP | 300KB |
| **Thumbnail** | 800×450px | WebP | 100KB |

**Format recommandé:** JPG pour photos, PNG pour graphiques, WebP pour le web (meilleur compression).

---

## 🎨 Style Guide Visuel Lurnia

### Palette de Couleurs

```css
/* Primaires */
--blue-600: #3b82f6   /* Bleu principal */
--purple-600: #8b5cf6 /* Purple accent */
--white: #ffffff

/* Secondaires */
--slate-900: #0f172a  /* Texte sombre */
--slate-600: #475569  /* Texte moyen */
--slate-50: #f8fafc   /* Background clair */

/* Gradients */
--gradient-primary: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)
--gradient-secondary: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)
```

### Typographie

- **Headlines:** Inter Bold, 72-96px
- **Subheadlines:** Inter SemiBold, 36-48px
- **Body:** Inter Regular, 24-32px

### Éléments de Marque

✅ Logo Lurnia (icône + texte)
✅ Gradient bleu-purple (signature visuelle)
✅ Icônes lucide-react style
✅ Coins arrondis (border-radius: 12-24px)
✅ Ombres douces (shadow-xl)

---

## 🖼️ Templates d'Images par Catégorie

### Template 1: Guides Pratiques

**Layout:**
```
┌─────────────────────────────────────┐
│  [LURNIA LOGO]                      │
│                                     │
│  [GROS TITRE]                       │
│  Comment [Action] avec l'IA        │
│                                     │
│  [ICÔNE CENTRALE]                   │
│  (YouTube + IA symbol)             │
│                                     │
│  [GRADIENT BACKGROUND]              │
└─────────────────────────────────────┘
```

**Exemple:** "Comment Poser des Questions à une Vidéo YouTube avec l'IA"

**Éléments:**
- Background: Gradient bleu-purple
- Icône: YouTube + bulle de dialogue + sparkles (IA)
- Badge: "Guide 2025" dans un coin
- Texte: Blanc sur gradient

### Template 2: Comparatifs & Reviews

**Layout:**
```
┌─────────────────────────────────────┐
│  VS                                 │
│  [Logo A] ⚔️ [Logo B]             │
│                                     │
│  Top 10 Meilleurs Outils           │
│  IA YouTube 2025                    │
│                                     │
│  [5 ÉTOILES] Comparatif            │
└─────────────────────────────────────┘
```

**Éléments:**
- Split screen (2 couleurs contrastées)
- Icônes des outils comparés
- Rating stars
- Badge "Comparatif 2025"

### Template 3: Statistiques & Data

**Layout:**
```
┌─────────────────────────────────────┐
│  📊 [CHIFFRE ÉNORME]                │
│  98% de Temps Gagné                 │
│                                     │
│  [Mini graphique]                   │
│  Avant IA → Après IA               │
│                                     │
│  lurnia.app                         │
└─────────────────────────────────────┘
```

**Éléments:**
- Chiffre géant (hero number)
- Mini visualisation de données
- Avant/Après comparison
- Call-to-action subtil

---

## 🛠️ Méthodes de Génération

### Méthode 1: Canva (Recommandé - Rapide & Facile)

**Setup (15 minutes):**

1. **Créer un compte Canva Pro** (gratuit 30 jours)
   - [canva.com](https://canva.com)

2. **Créer les templates:**

**Template Guide Pratique:**
```
1. Créer un design: 1200×630px
2. Background: Gradient (bleu #3b82f6 → purple #8b5cf6)
3. Ajouter logo Lurnia (coin haut gauche)
4. Titre: Inter Bold 72px, blanc
5. Icône centrale: Chercher "youtube", "ai", "question"
6. Badge: Rectangle arrondi "Guide 2025"
7. Sauvegarder comme "Template - Guide Pratique"
```

**Template Comparatif:**
```
1. Design: 1200×630px
2. Split screen: Bleu gauche, Purple droite
3. Titre centré: "VS" en énorme
4. Logos/icônes de chaque côté
5. Sous-titre: "Comparatif 2025"
6. Rating stars en bas
```

**Template Statistiques:**
```
1. Design: 1200×630px
2. Background: Blanc ou gradient léger
3. Chiffre énorme: 200px, bleu
4. Graph de progression (avant/après)
5. Logo Lurnia en bas
```

3. **Dupliquer & Personnaliser:**
   - Dupliquer le template
   - Changer le titre
   - Ajuster l'icône
   - Exporter en JPG (qualité 90%)

**Temps par image:** 2-3 minutes après setup

---

### Méthode 2: Figma (Design System Pro)

**Pour designers:**

1. **Créer un Design System Lurnia:**
   - Components: Buttons, badges, cards
   - Styles: Colors, typography, effects
   - Auto-layout pour responsive

2. **Templates avec variants:**
   - Template "Article" avec 3 variants
   - Swap icons via instances
   - Batch export

**Avantage:** Cohérence parfaite, scaling facile

**Temps:** Setup 2h, puis 1min par image

---

### Méthode 3: DALL-E / Midjourney (IA Générative)

**Prompt Template DALL-E:**

```
Create a modern, professional blog header image for a tech article.

Theme: [THEME - ex: "AI YouTube assistant"]
Style: Gradient background (blue #3b82f6 to purple #8b5cf6), clean UI design, minimalist
Elements: YouTube logo, AI sparkles icon, chat bubble
Text: "[ARTICLE TITLE]" in bold white text, centered
Layout: Professional SaaS marketing style, Lurnia branding
Dimensions: 1200×630px horizontal
Quality: High-res, web-optimized

Reference style: Modern SaaS landing page hero image, Stripe/Vercel aesthetic
```

**Exemple concret:**
```
Create a blog header image: Blue-purple gradient background, YouTube icon with AI sparkles, white bold text "Comment Poser des Questions à YouTube avec l'IA", Lurnia logo top-left, modern SaaS style, 1200x630px
```

**Midjourney Prompt:**
```
professional blog header, gradient blue to purple background, youtube logo with ai elements, text overlay "AI YouTube Assistant Guide", modern saas design, clean UI, 1200x630 aspect ratio, web banner style --ar 19:10 --v 6
```

**Coût:**
- DALL-E: 0.04€ par image (HD)
- Midjourney: 10$/mois (200 images)

**Avantage:** Unique, custom, rapide

**Inconvénient:** Nécessite édition pour ajouter texte précis

---

### Méthode 4: Script Automatisé (Volume)

**Stack:** Node.js + Canvas / Puppeteer

```javascript
const { createCanvas, loadImage } = require('canvas')

async function generateArticleImage(title, category, iconUrl) {
  const width = 1200
  const height = 630
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#3b82f6') // Blue
  gradient.addColorStop(1, '#8b5cf6') // Purple
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Logo Lurnia
  const logo = await loadImage('./logo.png')
  ctx.drawImage(logo, 40, 40, 150, 50)

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px Inter'
  ctx.textAlign = 'center'
  wrapText(ctx, title, width/2, height/2, width-100, 90)

  // Icon
  const icon = await loadImage(iconUrl)
  ctx.drawImage(icon, width/2-75, height-200, 150, 150)

  // Export
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 })
  fs.writeFileSync(`./output/${slug}.jpg`, buffer)
}

// Wrap text helper
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let yPos = y

  for (let word of words) {
    const testLine = line + word + ' '
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, yPos)
      line = word + ' '
      yPos += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, yPos)
}

// Usage
generateArticleImage(
  "Comment Poser des Questions à YouTube avec l'IA",
  "Guide Pratique",
  "./icons/youtube-ai.png"
)
```

**Setup:** 1-2h de dev
**Génération:** 50 images en 2 minutes

---

## 📋 Checklist par Image

### Avant Export

- [ ] **Dimensions correctes** (1200×630px pour OG)
- [ ] **Texte lisible** (minimum 72px pour titre)
- [ ] **Contraste suffisant** (WCAG AA: 4.5:1)
- [ ] **Logo Lurnia** présent
- [ ] **Gradient brand** utilisé
- [ ] **Icônes cohérentes** (lucide-react style)
- [ ] **Badge catégorie** ("Guide 2025", "Comparatif", etc.)

### Après Export

- [ ] **Compression** (TinyPNG, Squoosh)
- [ ] **Poids < 200KB**
- [ ] **Test sur Facebook Debugger** (og:image)
- [ ] **Test sur Twitter Card Validator**
- [ ] **Rename:** `[slug].jpg` (ex: `poser-questions-video-youtube-ia.jpg`)

---

## 🚀 Workflow de Production (50 Images)

### Option A: Canva Batch (Recommandé)

**Temps total: 2-3 heures**

1. **Setup templates** (30min)
   - Template Guide (1)
   - Template Comparatif (1)
   - Template Stats (1)

2. **Génération batch** (2h)
   - Dupliquer template × 50
   - Changer titre + icône (2min/image)
   - Export tous en JPG

3. **Optimisation** (30min)
   - Batch compress avec TinyPNG
   - Rename selon slugs
   - Upload to `/public/images/blog/`

### Option B: DALL-E Semi-Auto

**Temps total: 3-4 heures**

1. **Créer 10 prompts types** (30min)
2. **Générer 50 images** (2h)
   - DALL-E API ou interface
   - 1 image toutes les 2-3 min
3. **Post-production** (1.5h)
   - Ajouter texte avec Canva Quick
   - Compress
   - Upload

### Option C: Script Full Auto

**Temps total: 3h setup + 5min génération**

1. **Dev le script** (3h)
2. **Préparer JSON avec metadata** (30min)
3. **Run script** (5min)
   - Génère 50 images automatiquement
4. **Review qualité** (30min)

---

## 📊 KPIs Images

### Metrics à Suivre

1. **Click-Through Rate (CTR)** social media
   - Target: >3% sur LinkedIn
   - Target: >1.5% sur Twitter

2. **Engagement Rate**
   - Avec image: 5-10x plus d'engagement
   - Sans image: Baseline

3. **Load Time**
   - Target: < 1s pour charger l'image
   - Optimiser avec WebP

### A/B Testing

Tester 2-3 styles différents:
- **Style A:** Gradient + texte
- **Style B:** Photo + overlay
- **Style C:** Illustration minimaliste

Mesurer CTR après 1000 impressions chacun.

---

## 🎯 Quick Start (Prochaines 2 Heures)

**Action Plan:**

1. ✅ **Ouvrir Canva Pro** (essai gratuit)
2. 🎨 **Créer 1er template** (Guide Pratique)
3. 🖼️ **Générer 5 premières images**
   - Article 1: Poser questions vidéo YouTube IA
   - Article 2: Résumer vidéo 1 heure
   - Article 6: Résumer vidéo YouTube guide complet
   - Article 7: Gagner temps YouTube IA
   - Article 9: Meilleurs outils IA YouTube

4. 📦 **Compress** avec TinyPNG
5. ⬆️ **Upload** to `/public/images/blog/`
6. ✅ **Test** sur Facebook Debugger

**Résultat:** 5 articles avec images optimisées SEO, prêts à ranker sur Google.

---

## 📁 Structure de Fichiers

```
frontend/public/images/blog/
├── poser-questions-video-youtube-ia.jpg        (1200×630, <200KB)
├── resumer-video-1-heure-ia.jpg                (1200×630, <200KB)
├── assistant-personnel-youtuber-prefere.jpg    (1200×630, <200KB)
├── ia-citations-timestamps-youtube.jpg         (1200×630, <200KB)
├── outil-gratuit-transcription-youtube-ia.jpg  (1200×630, <200KB)
[... 50+ more]

frontend/public/images/blog/thumbnails/
├── poser-questions-video-youtube-ia-thumb.webp (800×450, <100KB)
[... 50+ thumbnails]
```

---

## 💡 Pro Tips

### 1. Réutilisez les Éléments

Créez une **bibliothèque d'assets**:
- 20+ icônes (YouTube, IA, questions, stats, etc.)
- 10+ gradients pré-configurés
- 5+ layouts templates

**Gain de temps:** 70%+

### 2. Automatisez la Compression

Script bash:
```bash
#!/bin/bash
for img in *.jpg; do
  convert "$img" -quality 90 -strip "compressed/$img"
done
```

### 3. Test Social Media

Avant de publier 50 images:
- Tester 1 image sur Facebook
- Vérifier le rendu (aperçu lien)
- Ajuster si nécessaire
- Batch-create le reste

### 4. Nommage Cohérent

**Format:** `[slug-article].jpg`
- Lowercase
- Hyphens (pas underscores)
- Matching article slug exactly

Pourquoi? SEO + facilité de dev.

---

## 🎬 Conclusion

**Méthode Recommandée pour Lurnia:**

🥇 **Canva Pro** pour les 50 premières images
   - Rapide (2-3h total)
   - Qualité professionnelle
   - Cohérence visuelle
   - Pas de coding requis

🥈 **Script automatisé** pour scaling (100+ images)
   - Investir 3h de dev
   - Générer images à l'infini
   - Parfait pour long-terme

**Next Steps Immédiats:**

1. Canva gratuit trial → Créer 3 templates
2. Générer 10 premières images
3. Test & iterate
4. Batch-create remaining 40

**Temps total estimé:** 3-4h pour 50 images professionnelles. 🚀
