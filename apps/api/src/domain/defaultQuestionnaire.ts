/** Questionnaire de référence Compatilo conforme à la spécification produit. */

export type DefaultQuestion = {
  type: string;
  prompt: string;
  required?: boolean;
  helpText?: string | null;
  config?: Record<string, unknown>;
};

export type DefaultPage = {
  title: string;
  description?: string | null;
  questions: DefaultQuestion[];
};

const key = (value: string) => ({ key: value });
const profile = (field: string) => ({ profileField: field });

export const DEFAULT_QUESTIONNAIRE = {
  title: 'Compatibilité de couple',
  description:
    'Le questionnaire de référence Compatilo : informations personnelles, favoris et compatibilité.',
  specVersion: 2,
  pages: [
    {
      title: 'Informations personnelles',
      questions: [
        {
          type: 'text',
          prompt: 'Prénom',
          config: { ...key('firstName'), ...profile('firstName'), minLength: 3, maxLength: 60 },
        },
        {
          type: 'text',
          prompt: 'Surnom',
          config: { ...key('nickname'), ...profile('nickname'), minLength: 3, maxLength: 60 },
        },
      ],
    },
    {
      title: 'Réseaux sociaux',
      questions: [
        {
          type: 'text',
          prompt: 'Snapchat',
          config: { ...key('snapchat'), ...profile('snapchat'), minLength: 3, maxLength: 60 },
        },
        {
          type: 'text',
          prompt: 'Instagram',
          config: { ...key('instagram'), ...profile('instagram'), minLength: 3, maxLength: 60 },
        },
        {
          type: 'phone',
          prompt: 'Numéro de téléphone',
          config: { ...key('phone'), ...profile('phone'), minLength: 3, maxLength: 30 },
        },
      ],
    },
    {
      title: 'Date de naissance',
      questions: [
        {
          type: 'date',
          prompt: 'Date de naissance',
          config: { ...key('birthDate'), ...profile('birthDate') },
        },
      ],
    },
    {
      title: 'Ville',
      questions: [
        {
          type: 'city',
          prompt: 'Ville',
          helpText: 'Recherche une ville, autorise la géolocalisation ou sélectionne une position.',
          config: { ...key('city'), ...profile('location') },
        },
      ],
    },
    {
      title: 'Origines',
      questions: [
        {
          type: 'origins',
          prompt: 'Origines',
          helpText: 'Sélectionne plusieurs origines, recherche dans la liste ou ajoute une origine personnalisée.',
          config: { ...key('origins'), ...profile('origins') },
        },
      ],
    },
    {
      title: 'Ce qui serait possible entre nous',
      questions: [
        ...[
          'Sorties',
          'Appels',
          'Se voir',
          'Exclusivité',
          'Cuisiner ensemble',
          '🔞',
          'Soutien émotionnel',
          'Sans prise de tête',
          'Câlins',
          'Bisous',
        ].map((prompt) => ({
          type: 'trilean',
          prompt,
          config: key(`possible.${prompt}`),
        })),
        {
          type: 'textarea',
          prompt: 'Autres',
          required: false,
          config: { ...key('possible.other'), maxLength: 500 },
        },
      ],
    },
    {
      title: 'Permis',
      questions: [
        { type: 'yesno', prompt: 'Tu as le permis ?', config: key('license') },
        { type: 'yesno', prompt: 'Tu as le code ?', required: false, config: key('drivingCode') },
      ],
    },
    {
      title: 'Cuisine',
      questions: [
        { type: 'yesno', prompt: 'Tu sais cuisiner ?', config: key('cooking') },
        {
          type: 'choice',
          prompt: 'Tu préfères cuisiner :',
          config: {
            ...key('cookingPreference'),
            options: [
              { value: 'SWEET', label: 'Sucré' },
              { value: 'SAVORY', label: 'Salé' },
            ],
            displayWhen: { key: 'cooking', equals: 'YES' },
          },
        },
      ],
    },
    {
      title: 'Animés',
      questions: [{ type: 'yesno', prompt: 'Tu regardes des animés ?', config: key('anime') }],
    },
    {
      title: 'Équipement',
      questions: [
        { type: 'yesno', prompt: 'Tu as un PC ?', config: key('pc') },
        { type: 'yesno', prompt: 'Tu as une console ?', config: key('console') },
      ],
    },
    {
      title: 'Situation',
      questions: [
        { type: 'yesno', prompt: 'Tu travailles ?', config: key('work') },
        { type: 'yesno', prompt: "Tu es à l'école ?", config: key('school') },
      ],
    },
  ] as DefaultPage[],
};
