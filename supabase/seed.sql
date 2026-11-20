-- =============================================================================
-- Dados de arranque: 20 candidatos FICTÍCIOS para testes.
-- Substitua-os pela lista real no painel de administração (Candidatos → Importar)
-- e desative/apague estes antes de abrir a votação real.
-- NOTA: não há números de membro neste ficheiro — esses importam-se no painel.
-- =============================================================================
insert into public.candidates (name) values
  ('Ana Sofia Martins'), ('Bruno Miguel Ferreira'), ('Carla Patrícia Sousa'), ('Diogo Alexandre Costa'),
  ('Eduarda Gonçalves'), ('Filipe André Rodrigues'), ('Gonçalo Pereira'), ('Helena Marques'),
  ('Inês Carvalho'), ('João Pedro Almeida'), ('Mariana Lopes'), ('Mário Jorge Ribeiro'),
  ('Marta Fonseca'), ('Nuno Tavares'), ('Patrícia Moreira'), ('Ricardo Antunes'),
  ('Sara Cristina Pinto'), ('Tiago Mendes'), ('Vasco Oliveira'), ('Beatriz Simões')
on conflict do nothing;
