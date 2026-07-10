/* Seed : compte administrateur + questionnaire de compatibilité v1 (publié). */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TRILEAN = {}; // config par défaut du type trilean (Oui / Possible / Non)

const pages: { title: string; description: string; questions: string[] }[] = [
  {
    title: 'Vie quotidienne',
    description: 'Vos habitudes et votre rythme de tous les jours.',
    questions: [
      'Aimerais-tu vivre ensemble dans les deux prochaines années ?',
      'Es-tu plutôt du matin ?',
      'Aimes-tu recevoir des amis à la maison régulièrement ?',
      'Le partage égal des tâches ménagères est-il important pour toi ?',
      'Pourrais-tu vivre avec un animal de compagnie ?',
      'As-tu besoin de moments de solitude au quotidien ?',
    ],
  },
  {
    title: 'Famille & engagement',
    description: 'Votre vision du couple et de la famille.',
    questions: [
      'Souhaites-tu te marier un jour ?',
      'Veux-tu avoir des enfants ?',
      'La proximité avec ta belle-famille est-elle importante pour toi ?',
      'Envisages-tu de t’engager à long terme dans cette relation ?',
      'Serais-tu prêt·e à déménager dans une autre ville par amour ?',
      'Les traditions familiales comptent-elles pour toi ?',
    ],
  },
  {
    title: 'Finances',
    description: 'Votre rapport à l’argent, sans tabou.',
    questions: [
      'Es-tu favorable à un compte bancaire commun ?',
      'Es-tu plutôt économe que dépensier·ère ?',
      'Les dépenses importantes doivent-elles être décidées à deux ?',
      'Serais-tu à l’aise si ton/ta partenaire gagnait beaucoup plus que toi ?',
      'Épargner régulièrement est-il une priorité pour toi ?',
    ],
  },
  {
    title: 'Valeurs & communication',
    description: 'Ce qui compte vraiment pour vous.',
    questions: [
      'La fidélité est-elle non négociable pour toi ?',
      'Préfères-tu régler un désaccord immédiatement plutôt que laisser retomber ?',
      'La spiritualité ou la religion a-t-elle une place dans ta vie ?',
      'Peux-tu pardonner facilement ?',
      'L’honnêteté totale est-elle plus importante que ménager l’autre ?',
      'Es-tu à l’aise pour parler de tes émotions ?',
    ],
  },
  {
    title: 'Loisirs & voyages',
    description: 'Votre manière de profiter du temps libre.',
    questions: [
      'Aimes-tu partir à l’aventure sans tout planifier ?',
      'Préfères-tu la montagne à la plage ?',
      'Faire du sport ensemble te plairait-il ?',
      'Une soirée idéale peut-elle être simplement un film à la maison ?',
      'Aimerais-tu voyager à l’étranger au moins une fois par an ?',
      'Es-tu à l’aise avec le fait d’avoir des loisirs séparés ?',
    ],
  },
  {
    title: 'Intimité & affection',
    description: 'Votre langage de l’amour.',
    questions: [
      'Les gestes d’affection en public te mettent-ils à l’aise ?',
      'As-tu besoin de mots doux et de compliments réguliers ?',
      'La tendresse au quotidien est-elle aussi importante que la passion ?',
      'Es-tu à l’aise pour parler de tes envies et de tes limites ?',
      'Une routine bien installée peut-elle nourrir le désir ?',
    ],
  },
  {
    title: 'Projets d’avenir',
    description: 'Là où vous voulez aller, ensemble.',
    questions: [
      'Te vois-tu vivre à l’étranger un jour ?',
      'Préférerais-tu vivre à la campagne plutôt qu’en ville ?',
      'La réussite professionnelle passe-t-elle avant tout le reste ?',
      'Aimerais-tu monter un projet commun (maison, entreprise, association…) ?',
      'Serais-tu prêt·e à faire des sacrifices personnels pour le couple ?',
      'Imagines-tu votre relation dans dix ans ?',
    ],
  },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@compatilo.app').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'compatilo-admin';

  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Admin prêt : ${email}`);

  const existing = await prisma.questionnaire.findFirst({
    where: { title: 'Compatibilité de couple' },
  });
  if (existing) {
    console.log('Questionnaire déjà présent, seed ignoré.');
    return;
  }

  await prisma.questionnaire.create({
    data: {
      title: 'Compatibilité de couple',
      description: 'Le questionnaire de référence Compatilo : 40 questions pour découvrir votre compatibilité.',
      versions: {
        create: {
          version: 1,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          pages: {
            create: pages.map((p, pi) => ({
              title: p.title,
              description: p.description,
              position: pi,
              questions: {
                create: p.questions.map((prompt, qi) => ({
                  type: 'trilean',
                  prompt,
                  position: qi,
                  config: TRILEAN,
                })),
              },
            })),
          },
        },
      },
    },
  });
  console.log('Questionnaire « Compatibilité de couple » (v1) publié.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
