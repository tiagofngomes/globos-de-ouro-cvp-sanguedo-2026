# 🏆 Globos de Ouro CVP Sanguedo 2026

Aplicação web de votação para os **Globos de Ouro da Cruz Vermelha Portuguesa — Delegação de Sanguedo 2026**.
Pensada primeiro para o telemóvel, com estética de gala (preto, dourado e vermelho CVP), votação anónima em duas fases, painel de administração e **Modo Gala** para revelar os vencedores no dia da cerimónia.

- **Frontend:** React + TypeScript + Tailwind CSS + Framer Motion (alojado no GitHub Pages)
- **Backend / base de dados:** Supabase (Postgres + funções RPC + RLS + Auth para administradores)

---

## ✨ Funcionalidades

| Área | O que faz |
| --- | --- |
| Página inicial | Título animado, troféu, holofotes, contagem decrescente sincronizada com o servidor, calendário das fases e cartões das 6 categorias |
| Votação | Entrada com o número de membro (“convite”), uma categoria de cada vez, pesquisa com autocomplete (ignora maiúsculas e acentos), lista completa A–Z, progresso, revisão e submissão única |
| Grande Final | Só os finalistas de cada categoria, em cartões de toque |
| Resultados | Página pública dos vencedores, só depois de o administrador os publicar (sem números de votos) |
| Administração | Painel com participação em tempo real, gráficos de barras por categoria, apuramento e resolução de empates, membros, candidatos, categorias, datas, suspensão/encerramento, publicação e exportação CSV |
| Modo Gala | Apresentação final em ecrã completo: categoria → nomeados → gráfico “a brincar” com rufar de tambores (as barras sobem e descem para enganar o público) → prato e bombo: o gráfico para nos valores reais e destaca o vencedor → 3 segundos depois, nome do vencedor em grande (fanfarra de metais + confetis) → resumo final |
| Demonstração | `#/demo` — 20 candidatos fictícios, 100 números de teste (1001–1100) e resultados simulados, tudo no navegador e totalmente separado da votação real |

### Fases (calculadas sempre pelo servidor)

| Fase | Quando |
| --- | --- |
| `pre_voting` | Antes da abertura das nomeações |
| `phase1` — Nomeações | Até **10/12/2026 às 23h59** (hora de Portugal continental) |
| `counting` — Apuramento | Depois do fecho, até a final abrir |
| `phase2` — Grande Final | A partir de **11/12/2026 às 00h00**, se os finalistas estiverem apurados |
| `awaiting_gala` | Final encerrada (data definida pelo administrador) |
| `results` | Resultados publicados pelo administrador |

Às 00h00 de 11/12, o primeiro acesso ao site apura automaticamente os **5 mais votados** de cada categoria. Se houver **empate na última vaga**, a final não abre: o painel sinaliza o empate e o administrador escolhe quem passa (ou inclui todos os empatados).

---

## 🔒 Segurança e anonimato

- **Os votos não estão ligados a quem votou.** A tabela `vote_participation` regista apenas *que* um número votou numa fase; a tabela `vote_tallies` guarda apenas **totais por candidato**. Não existe boletim individual nem carimbo temporal que permita correlacionar. Nem os administradores conseguem ver em quem alguém votou, nem sequer *quem* já votou — apenas os totais.
- **Voto único por fase**, garantido pela chave primária `(member_id, phase)` dentro de uma transação. Pedidos simultâneos não conseguem votar duas vezes.
- **Datas e regras validadas no servidor** (`now()` do Postgres). O relógio do telemóvel nunca decide nada.
- **Limitação de tentativas:** 10 tentativas falhadas por IP, ou 5 por número, em 15 minutos, bloqueiam o acesso temporariamente.
- **Sessões temporárias:** o número de membro dá acesso a um token aleatório (guardado apenas em hash) válido 45 minutos.
- **Preparado para autenticação adicional:** cada membro pode ter um **PIN opcional** (guardado com bcrypt). Se definido, passa a ser pedido ao votar.
- **Nada sensível no repositório:** números de membro e credenciais vivem apenas no Supabase. A chave `anon` é pública por natureza; a proteção está nas políticas RLS e nas funções.
- Categorias, candidatos e membros com votos **não podem ser apagados** (apenas desativados).

---

## 🚀 Configuração (passo a passo)

### 1. Criar o projeto Supabase

1. Crie uma conta em <https://supabase.com> e um projeto novo (região: *West EU*).
2. Abra **SQL Editor** e execute, por esta ordem:
   1. `supabase/migrations/20261120000000_globos_de_ouro.sql` (estrutura, regras e categorias)
   2. `supabase/seed.sql` (opcional: 20 candidatos fictícios para testes)

### 2. Criar a conta de administrador

1. Em **Authentication → Users → Add user**, crie o utilizador (email + palavra-passe) e marque *Auto Confirm*.
2. No **SQL Editor**, dê-lhe permissões:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'o-seu-email@exemplo.pt';
   ```
3. Recomendado: em **Authentication → Providers → Email**, desative *Allow new users to sign up*.

### 3. Ligar o frontend

```bash
# criar o ficheiro .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Os valores estão em **Project Settings → API** (URL e chave `anon public`).

### 4. Publicar no GitHub Pages

1. No GitHub: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Faça *push* para `main`. O workflow `.github/workflows/deploy.yml` corre os testes, compila e publica.

O site fica em `https://<utilizador>.github.io/globos-de-ouro-cvp-sanguedo-2026/`.
Sem as variáveis definidas, o site publicado funciona apenas em **modo demonstração**.

### 5. Preparar a votação real

No painel (`…/#/admin`):

1. **Membros → Importar lista:** cole ou carregue o CSV com os números de membro.
2. **Candidatos → Importar nomes:** carregue a lista real e desative ou apague os fictícios.
3. **Datas e fases:** confirme as datas. Na zona de perigo pode apagar votos de testes.

---

## 🎬 No dia da gala

1. Encerre a final (**Datas e fases → Encerrar a fase atual agora**, ou defina a data de fecho).
2. Abra o **Modo Gala** (botão vermelho no painel) no computador ligado ao projetor.
3. Teclas: **→ / Espaço** avançar · **←** recuar · **F** ecrã completo · **S** som · **Esc** sair.
   Também pode avançar com clique ou toque, ou usar um apresentador de diapositivos sem fios.
4. No fim, publique os resultados (**Datas e fases → Publicar resultados**) para todos os verem no telemóvel.

> Antes da final, o Modo Gala funciona como **ensaio** com os dados das nomeações.

---

## 🎨 Identidade visual

- Para usar o logótipo oficial da CVP, coloque o ficheiro em `public/brand/cvp-logo.svg` (ou `.png`). É usado automaticamente; sem ele, aparece o emblema da cruz vermelha desenhado em SVG.
- Cores principais em `tailwind.config.js` (`gold`, `gala`, `cvp`).

---

## 🧪 Testes

```bash
npm test          # pesquisa inteligente de nomes (acentos, maiúsculas, várias palavras)
npm run test:db   # base de dados num Postgres real (PGlite): voto único, anonimato,
                  # limitação de tentativas, PIN, empates, fases, permissões, resultados
npm run build     # verificação de tipos + compilação de produção
```

---

## 🗂️ Estrutura

```
src/
  api/            contrato comum (types.ts), implementação Supabase e contexto
  demo/           API de demonstração (localStorage) e dados fictícios
  components/     layout (fundo de gala), ui (troféu, contagem, marca CVP), vote, admin, charts
  pages/          início, votação, resultados, Modo Gala e páginas de administração
  lib/            pesquisa sem acentos, datas em hora de Lisboa, CSV, confetis, sons
supabase/
  migrations/     esquema, RLS e funções (toda a lógica de negócio)
  seed.sql        candidatos fictícios
  tests/          testes da base de dados
```
