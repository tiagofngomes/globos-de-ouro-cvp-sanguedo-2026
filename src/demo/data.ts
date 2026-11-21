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
    description: 'Reconhecer e valorizar novos talentos que se destacaram pelo seu desempenho este ano.',
    icon: 'sparkles',
    sort_order: 1,
  },
  {
    id: 'cat-carreira',
    slug: 'carreira',
    name: 'Prémio de Carreira',
    description: 'Homenagear e valorizar um percurso de voluntariado, reconhecendo a dedicação e o legado ao longo dos anos.',
    icon: 'award',
    sort_order: 3,
  },
  {
    id: 'cat-eficiencia',
    slug: 'eficiencia',
    name: 'Prémio de Eficiência',
    description: 'Reconhecer e valorizar quem contribui para a melhoria contínua, transformando desafios em resultados concretos.',
    icon: 'zap',
    sort_order: 4,
  },
  {
    id: 'cat-inovacao',
    slug: 'inovacao',
    name: 'Prémio de Inovação e Criatividade',
    description: 'Reconhecer e valorizar a originalidade, a criatividade e a capacidade de inovar.',
    icon: 'lightbulb',
    sort_order: 2,
  },
  {
    id: 'cat-voluntariado',
    slug: 'voluntariado',
    name: 'Prémio Espírito de Voluntariado',
    description:
      'Reconhecer e valorizar a dedicação, o altruísmo e o espírito solidário de quem está sempre disponível para ajudar, cumprindo os Princípios Fundamentais da Cruz Vermelha.',
    icon: 'heart',
    sort_order: 5,
  },
  {
    id: 'cat-dedicacao',
    slug: 'dedicacao',
    name: 'Prémio de Dedicação',
    description: 'Homenagear e valorizar a dedicação, a lealdade e o contributo de quem veste a camisola.',
    icon: 'medal',
    sort_order: 6,
  },
]
