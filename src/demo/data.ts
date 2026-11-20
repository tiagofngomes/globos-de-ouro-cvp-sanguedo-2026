import type { Category } from '../api/types'

/** 20 nomes fictícios portugueses (apenas para demonstração). */
export const DEMO_CANDIDATES = [
  'Ana Sofia Martins',
  'Bruno Miguel Ferreira',
  'Carla Patrícia Sousa',
  'Diogo Alexandre Costa',
  'Eduarda Gonçalves',
  'Filipe André Rodrigues',
  'Gonçalo Pereira',
  'Helena Marques',
  'Inês Carvalho',
  'João Pedro Almeida',
  'Mariana Lopes',
  'Mário Jorge Ribeiro',
  'Marta Fonseca',
  'Nuno Tavares',
  'Patrícia Moreira',
  'Ricardo Antunes',
  'Sara Cristina Pinto',
  'Tiago Mendes',
  'Vasco Oliveira',
  'Beatriz Simões',
]

/** Mesmas categorias que a migração da base de dados cria. */
export const DEMO_CATEGORIES: Category[] = [
  {
    id: 'cat-revelacao',
    slug: 'revelacao',
    name: 'Prémio Revelação do Ano',
    description: 'Para quem chegou e brilhou: o elemento que mais surpreendeu pela positiva este ano.',
    icon: 'sparkles',
    sort_order: 1,
  },
  {
    id: 'cat-carreira',
    slug: 'carreira',
    name: 'Prémio de Carreira',
    description: 'Uma vida de dedicação à causa. Reconhece o percurso, a experiência e o exemplo que inspira gerações.',
    icon: 'award',
    sort_order: 2,
  },
  {
    id: 'cat-eficiencia',
    slug: 'eficiencia',
    name: 'Prémio de Eficiência',
    description: 'Rigor, rapidez e competência. Para quem resolve com calma o que parece impossível.',
    icon: 'zap',
    sort_order: 3,
  },
  {
    id: 'cat-inovacao',
    slug: 'inovacao',
    name: 'Prémio de Inovação e Criatividade',
    description: 'Ideias novas, soluções inesperadas. Para quem pensa fora da caixa e torna a delegação melhor.',
    icon: 'lightbulb',
    sort_order: 4,
  },
  {
    id: 'cat-voluntariado',
    slug: 'voluntariado',
    name: 'Prémio Espírito de Voluntariado',
    description: 'Humanidade em ação. Para quem encarna os valores da Cruz Vermelha em cada gesto.',
    icon: 'heart',
    sort_order: 5,
  },
  {
    id: 'cat-dedicacao',
    slug: 'dedicacao',
    name: 'Prémio de Dedicação',
    description: 'Sempre presente, sempre disponível. Para quem nunca falta quando é preciso.',
    icon: 'medal',
    sort_order: 6,
  },
]
