// Testa a migração num Postgres real (PGlite/WASM) com um ambiente semelhante ao Supabase:
// regras de voto, anonimato, limitação de tentativas, empates, fases e permissões.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Executar com: npm run test:db
// --sem-grants simula um projeto criado com "Grant API access to new tables
// automatically" desligado (sem privilégios automáticos nas tabelas novas).
const autoGrants = !process.argv.includes('--sem-grants')
console.log(`Cenário: privilégios automáticos nas tabelas ${autoGrants ? 'LIGADOS' : 'DESLIGADOS'}
`)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migration = fs.readFileSync(`${root}/supabase/migrations/20261120000000_globos_de_ouro.sql`, 'utf8')
const seed = fs.readFileSync(`${root}/supabase/seed.sql`, 'utf8')

const db = new PGlite({ extensions: { pgcrypto, unaccent } })
let failures = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`)
  if (!cond) failures++
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const val = async (sql, params) => Object.values(await one(sql, params))[0]

// ---- ambiente estilo Supabase
await db.exec(`
  create schema if not exists extensions;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema extensions to anon, authenticated;
  ${autoGrants ? 'alter default privileges in schema public grant all on tables to anon, authenticated;' : ''}
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
`)
// O Supabase recusa (extensão safeupdate) DELETE/UPDATE sem WHERE em pedidos vindos do site.
// O PGlite não tem essa proteção, por isso verifica-se no próprio SQL.
{
  // cada instrução (separada por ";") que começa por DELETE ou UPDATE tem de ter WHERE
  const statements = migration
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((st) =>
      st
        .split(/\b(?:begin|then|loop|else)\b/i)
        .pop()
        .trim(),
    )
  const unsafe = statements.filter((st) => /^(delete\s+from|update)\s/i.test(st) && !/\bwhere\b/i.test(st))
  ok(unsafe.length === 0, `nenhum DELETE/UPDATE sem WHERE na migração${unsafe.length ? ': ' + unsafe.map((u) => u.slice(0, 60)).join(' | ') : ''}`)
}
await db.exec(migration)
await db.exec(seed)
ok(true, 'migração e seed aplicados')

const asAnon = async (ip = '10.0.0.1') => {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.headers', '{"x-forwarded-for":"${ip}, 172.0.0.1"}', false); set role anon;`,
  )
}
const asSuper = () => db.exec(`reset role;`)
const asUser = async (uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`)
}

// ---- datas: as fases nunca se sobrepõem (garantido pela base de dados)
const badDate = async (sql) => {
  try {
    await db.exec(sql)
    return false
  } catch (e) {
    return /dates_order|check constraint/i.test(e.message)
  }
}
ok(
  await badDate(`update public.event_settings set phase1_closes_at = phase1_opens_at - interval '1 day' where id`),
  'recusa fecho da 1ª fase antes da abertura',
)
ok(
  await badDate(`update public.event_settings set phase2_opens_at = phase1_closes_at - interval '1 hour' where id`),
  'recusa 2ª fase a abrir antes do fecho da 1ª',
)
ok(
  await badDate(`update public.event_settings set phase2_closes_at = phase2_opens_at - interval '1 hour' where id`),
  'recusa fecho da 2ª fase antes da abertura',
)
ok(!(await badDate(`update public.event_settings set phase2_closes_at = phase2_opens_at + interval '5 days' where id`)), 'aceita datas pela ordem certa')
await db.exec(`update public.event_settings set phase2_closes_at = null where id`)

// ---- dados
await asSuper()
await db.exec(`insert into public.members (member_number) select g::text from generate_series(1001, 1030) g;`)
const cats = (await db.query(`select id from public.categories order by sort_order`)).rows.map((r) => r.id)
const cands = (await db.query(`select id, name from public.candidates order by name`)).rows
ok(cats.length === 6 && cands.length === 20, '6 categorias e 20 candidatos')

// ---- estado público
await asAnon()
let st = await val(`select public.get_public_state()`)
ok(st.phase === 'phase1', `fase atual = phase1 (${st.phase})`)
ok(st.categories.length === 6, 'estado público inclui as categorias')
ok(st.codes_numeric === true, 'códigos só com números: teclado numérico')

// ---- anon sem acesso direto
for (const t of ['members', 'vote_tallies', 'vote_participation', 'candidates', 'event_settings']) {
  let denied = false
  try {
    const r = await db.query(`select * from public.${t}`)
    denied = r.rows.length === 0
  } catch {
    denied = true
  }
  ok(denied, `anon não lê ${t}`)
}
let blocked = false
try {
  await db.query(`select public.admin_overview()`)
} catch {
  blocked = true
}
ok(blocked, 'anon não executa funções de administração')

// ---- sessão e voto
let s = await val(`select public.start_voting_session('9999')`)
ok(s.ok === false && s.error === 'not_authorized', 'número desconhecido é recusado')
s = await val(`select public.start_voting_session(' 1001 ')`)
ok(s.ok === true && s.candidates.length === 20 && s.token, 'número válido abre sessão com a lista de candidatos')
const ballot = (pick) => JSON.stringify(cats.map((c, i) => ({ category_id: c, candidate_id: pick(i) })))
let r = await val(`select public.submit_ballot($1, $2::jsonb)`, [s.token, JSON.stringify(JSON.parse(ballot((i) => cands[i].id)).slice(0, 5))])
ok(r.ok === false && r.error === 'invalid_ballot', 'boletim incompleto é recusado')
r = await val(`select public.submit_ballot($1, $2::jsonb)`, [
  s.token,
  JSON.stringify(cats.map((c) => ({ category_id: c, candidate_id: '00000000-0000-0000-0000-000000000000' }))),
])
ok(r.ok === false && r.error === 'invalid_ballot', 'candidato inexistente é recusado')
r = await val(`select public.submit_ballot($1, $2::jsonb)`, [s.token, ballot((i) => cands[i].id)])
ok(r.ok === true, 'boletim completo é aceite')
r = await val(`select public.submit_ballot($1, $2::jsonb)`, [s.token, ballot((i) => cands[i].id)])
ok(r.ok === false && r.error === 'session_expired', 'o mesmo token não pode ser reutilizado')
s = await val(`select public.start_voting_session('1001')`)
ok(s.ok === false && s.error === 'already_voted', 'número bloqueado após votar na fase 1')

// duas sessões do mesmo membro abertas "em paralelo": só uma pode votar
const s2a = await val(`select public.start_voting_session('1002')`)
await asAnon('10.0.0.9')
const s2b = await val(`select public.start_voting_session('1002')`)
r = await val(`select public.submit_ballot($1, $2::jsonb)`, [s2a.token, ballot((i) => cands[i].id)])
ok(r.ok === false, 'sessão antiga é invalidada quando o membro abre nova sessão')
r = await val(`select public.submit_ballot($1, $2::jsonb)`, [s2b.token, ballot((i) => cands[i].id)])
ok(r.ok === true, 'sessão mais recente vota')

// ---- anonimato: participação e votos não têm ligação
await asSuper()
const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'vote_tallies'`)).rows.map((r) => r.column_name)
ok(!cols.some((c) => /member|time|created|session/.test(c)), `vote_tallies sem ligação a membros nem carimbos temporais (${cols.join(', ')})`)
const pcols = (await db.query(`select column_name from information_schema.columns where table_name = 'vote_participation'`)).rows.map((r) => r.column_name)
ok(pcols.length === 2, `vote_participation só tem membro e fase (${pcols.join(', ')})`)

// ---- limitação de tentativas
await asAnon('66.66.66.66')
let last
for (let k = 0; k < 11; k++) last = await val(`select public.start_voting_session($1)`, [`X${k}`])
ok(last.error === 'too_many_attempts', 'IP bloqueado após 10 tentativas falhadas')
s = await val(`select public.start_voting_session('1003')`)
ok(s.error === 'too_many_attempts', 'bloqueio aplica-se mesmo a números válidos a partir desse IP')
await asAnon('10.1.1.1')
s = await val(`select public.start_voting_session('1003')`)
ok(s.ok === true, 'outros IPs continuam a poder votar')

// ---- PIN opcional
await asSuper()
const adminId = await val(`insert into auth.users (email) values ('admin@x.pt') returning id`)
await db.query(`insert into public.admins (user_id) values ($1)`, [adminId])
const m5 = await val(`select id from public.members where member_number = '1005'`)
await asUser(adminId)
await db.query(`select public.admin_set_member_pin($1, '4321')`, [m5])
let pinHidden = false
try {
  await db.query(`select pin_hash from public.members`)
} catch {
  pinHidden = true
}
ok(pinHidden, 'administrador não consegue ler o hash do PIN')
const hasPin = await val(`select has_pin from public.members where id = $1`, [m5])
ok(hasPin === true, 'has_pin visível ao administrador')

// ---- operações diretas do painel (tabelas)
const tryq = async (sql, params) => {
  try {
    await db.query(sql, params)
    return true
  } catch (e) {
    console.log('   ↳', e.message)
    return false
  }
}
ok(await tryq(`select * from public.event_settings`), 'admin lê as definições')
ok(await tryq(`update public.event_settings set updated_at = now() where id`), 'admin altera as definições')
ok(await tryq(`select * from public.categories`), 'admin lê categorias')
ok(await tryq(`update public.categories set description = description where true`), 'admin edita categorias')
ok(await tryq(`insert into public.candidates (name) values ('Teste Temporário')`), 'admin cria candidato')
ok(await tryq(`update public.candidates set active = true where name = 'Teste Temporário'`), 'admin edita candidato')
ok(await tryq(`delete from public.candidates where name = 'Teste Temporário'`), 'admin apaga candidato sem votos')
ok(await tryq(`insert into public.members (member_number) values ('T-1')`), 'admin cria membro')
ok(await tryq(`update public.members set active = false where member_number = 'T-1'`), 'admin desativa membro')
ok(await tryq(`delete from public.members where member_number = 'T-1'`), 'admin apaga membro sem votos')
ok(!(await tryq(`select * from public.vote_tallies`)), 'admin NÃO lê os totais diretamente (só pelas funções)')
ok(await tryq(`select * from public.finalists`), 'admin lê finalistas')
ok(!(await tryq(`select * from public.vote_participation`)), 'admin NÃO lê quem votou (vote_participation)')
await asAnon('10.2.2.2')
s = await val(`select public.start_voting_session('1005')`)
ok(s.error === 'pin_required', 'PIN pedido quando definido')
s = await val(`select public.start_voting_session('1005', '0000')`)
ok(s.error === 'invalid_pin', 'PIN errado recusado')
s = await val(`select public.start_voting_session('1005', '4321')`)
ok(s.ok === true, 'PIN certo aceite')

// ---- administração
const otherId = await (async () => {
  await asSuper()
  return val(`insert into auth.users (email) values ('x@x.pt') returning id`)
})()
await asUser(otherId)
blocked = false
try {
  await db.query(`select public.admin_overview()`)
} catch {
  blocked = true
}
ok(blocked, 'utilizador autenticado sem ser admin é recusado')
blocked = false
try {
  const rr = await db.query(`select * from public.members`)
  blocked = rr.rows.length === 0
} catch {
  blocked = true
}
ok(blocked, 'utilizador autenticado sem ser admin não vê membros')

await asUser(adminId)
const ov = await val(`select public.admin_overview()`)
ok(ov.phase1_voters === 2 && ov.members_active === 30, `overview: ${ov.phase1_voters} votantes, ${ov.members_active} membros`)
// com a 1ª fase aberta: vê-se a participação, mas não os resultados
ok(ov.results_visible.phase1 === false && ov.results_visible.phase2 === false, 'resultados marcados como escondidos com a fase aberta')
ok((await db.query(`select * from public.admin_results(1)`)).rows.length === 0, 'admin_results(1) não devolve nada com a 1ª fase aberta')
ok((await db.query(`select * from public.admin_finalist_proposal()`)).rows.length === 0, 'proposta de finalistas escondida com a 1ª fase aberta')
const lm = (await db.query(`select * from public.admin_list_members()`)).rows
ok(
  lm.length === 30 && lm.filter((m) => m.voted_phase1).length === 2 && lm.every((m) => !m.voted_phase2),
  'lista de códigos indica os 2 já utilizados na 1ª fase',
)
ok(!Object.keys(lm[0]).some((k) => /cand|categ|vote(?!d_)/.test(k)), 'lista de códigos não tem qualquer informação sobre os votos')
ok(lm[0].member_number === '1001' && lm[9].member_number === '1010', 'códigos ordenados')
const imp = await val(`select public.admin_import_members(array['2001',' 2002 ','2001','1001',''])`)
ok(imp.inserted === 2, `importação de membros ignora duplicados (${JSON.stringify(imp)})`)
const impc = await val(`select public.admin_import_candidates(array['Zé Novo','ze novo','Ana Sofia Martins','X'])`)
ok(impc.inserted === 1, `importação de candidatos ignora duplicados/acentos (${JSON.stringify(impc)})`)
let delBlocked = false
try {
  await db.query(`delete from public.candidates where id = $1`, [cands[0].id])
} catch {
  delBlocked = true
}
ok(delBlocked, 'candidato com votos não pode ser apagado')
r = await val(`select public.admin_set_finalists('{}'::jsonb)`)
ok(r.ok === false, 'não é possível confirmar finalistas com a fase 1 aberta')

// ---- apuramento com empate na 5.ª posição
await asSuper()
await db.exec(`delete from public.vote_tallies;`)
const c0 = cats[0]
// categoria 0: votos 10,9,8,7,5,5,5,1 -> empate na 5.ª vaga entre 3 candidatos
const votes0 = [10, 9, 8, 7, 5, 5, 5, 1]
for (let k = 0; k < votes0.length; k++) await db.query(`insert into public.vote_tallies values (1, $1, $2, $3)`, [c0, cands[k].id, votes0[k]])
// restantes categorias: sem empates
for (const c of cats.slice(2)) for (let k = 0; k < 7; k++) await db.query(`insert into public.vote_tallies values (1, $1, $2, $3)`, [c, cands[k].id, 20 - k])
// categoria 1: um candidato com 50 votos e DEZ empatados com 5 -> os administradores escolhem 4 dos 10
const c1 = cats[1]
await db.query(`insert into public.vote_tallies values (1, $1, $2, 50)`, [c1, cands[0].id])
for (let k = 1; k <= 10; k++) await db.query(`insert into public.vote_tallies values (1, $1, $2, 5)`, [c1, cands[k].id])
await db.exec(`update public.event_settings set phase1_closes_at = now() - interval '2 hours', phase2_opens_at = now() - interval '1 hour';`)
await asAnon('10.3.3.3')
st = await val(`select public.get_public_state()`)
ok(st.phase === 'counting', `com empate, a final não abre sozinha (fase: ${st.phase})`)
await asUser(adminId)
const prop = (await db.query(`select * from public.admin_finalist_proposal()`)).rows.filter((p) => p.category_id === c0)
ok(
  prop.filter((p) => p.status === 'qualified').length === 4 && prop.filter((p) => p.status === 'tied').length === 3,
  'empate detetado: 4 apurados + 3 empatados',
)
const prop1 = (await db.query(`select * from public.admin_finalist_proposal()`)).rows.filter((p) => p.category_id === c1)
ok(
  prop1.filter((p) => p.status === 'qualified').length === 1 && prop1.filter((p) => p.status === 'tied').length === 10,
  '1 com 50 votos + 10 empatados com 5: 1 apurado + 10 empatados para decidir',
)
const ovTies = await val(`select public.admin_overview()`)
ok(ovTies.ties.length === 2 && ovTies.ties.includes(c0) && ovTies.ties.includes(c1), 'as 2 categorias com empate são sinalizadas ao administrador')
let autoGone = false
try {
  await db.query(`select public.admin_auto_finalize()`)
} catch {
  autoGone = true
}
ok(autoGone, 'já não existe apuramento automático')

// entre 2 e 8 finalistas por categoria
const selWith = (count) => {
  const out = {}
  for (const c of cats) out[c] = cands.slice(0, 5).map((x) => x.id)
  out[c1] = cands.slice(0, count).map((x) => x.id)
  return out
}
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify(selWith(1))])
ok(r.ok === false && /entre 2 e 8/.test(r.error), 'recusa 1 finalista numa categoria')
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify(selWith(9))])
ok(r.ok === false && /entre 2 e 8/.test(r.error), 'recusa 9 finalistas numa categoria')
ok((await val(`select count(*)::int from public.finalists`)) === 0, 'nada fica gravado quando a seleção é recusada')
let badN = false
try {
  await db.exec(`update public.event_settings set finalists_per_category = 9 where id`)
} catch {
  badN = true
}
ok(badN, 'número recomendado de finalistas tem de estar entre 2 e 8')

const sel = {}
for (const c of cats) {
  const rows = (await db.query(`select * from public.admin_finalist_proposal()`)).rows.filter((p) => p.category_id === c && p.status !== 'out')
  sel[c] = rows.slice(0, 5).map((p) => p.candidate_id)
}
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify(sel)])
ok(r.ok === true, 'administrador resolve o empate e confirma os finalistas')
const nf = await val(`select count(*)::int from public.finalists`)
ok(nf === 30, `30 finalistas (${nf})`)
const fin1 = (await db.query(`select candidate_id from public.finalists where category_id = $1`, [c1])).rows.map((r) => r.candidate_id).sort()
ok(JSON.stringify(fin1) === JSON.stringify([...sel[c1]].sort()), 'na categoria dos 10 empatados passam exatamente os 4 escolhidos + o de 50 votos')

// ---- fase 2
await asAnon('10.4.4.4')
st = await val(`select public.get_public_state()`)
ok(st.phase === 'phase2', `final aberta (fase: ${st.phase})`)
s = await val(`select public.start_voting_session('1001')`)
ok(s.ok === true && s.finalists.length === 30 && s.candidates.length === 0, 'quem votou na fase 1 pode votar na final; recebe só finalistas')
const notFinalist = cands[7].id
r = await val(`select public.submit_ballot($1, $2::jsonb)`, [
  s.token,
  JSON.stringify(cats.map((c) => ({ category_id: c, candidate_id: c === c0 ? notFinalist : sel[c][0] }))),
])
ok(r.ok === false && r.error === 'invalid_ballot', 'voto em não finalista é recusado')
r = await val(`select public.submit_ballot($1, $2::jsonb)`, [s.token, JSON.stringify(cats.map((c) => ({ category_id: c, candidate_id: sel[c][1] })))])
ok(r.ok === true, 'voto na final aceite')
s = await val(`select public.start_voting_session('1001')`)
ok(s.error === 'already_voted', 'bloqueado após votar na final')

// ---- resultados
let pub = await val(`select public.get_public_results()`)
ok(pub.published === false, 'resultados privados durante a votação')
await asUser(adminId)
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify(sel)])
ok(r.ok === false, 'finalistas bloqueados depois de existirem votos na final')
ok((await db.query(`select * from public.admin_results(2)`)).rows.length === 0, 'resultados da 2ª fase escondidos enquanto está aberta')
ok((await db.query(`select * from public.admin_results(1)`)).rows.length > 0, 'resultados da 1ª fase visíveis depois do fecho')
await db.exec(`update public.event_settings set phase2_closes_at = now() - interval '1 minute' where id;`)
const res2 = (await db.query(`select * from public.admin_results(2)`)).rows
ok(res2.length === 30 && res2.filter((x) => x.votes === 1).length === 6, 'depois do fecho: resultados da 2ª fase com todos os finalistas, 6 com 1 voto')
await asAnon('10.5.5.5')
st = await val(`select public.get_public_state()`)
ok(st.phase === 'awaiting_gala', `após fecho: ${st.phase}`)
s = await val(`select public.start_voting_session('1010')`)
ok(s.error === 'voting_closed', 'sem votações após o fecho')
await asUser(adminId)
// publicar só a partir do dia da gala
const tryPublish = async () => {
  try {
    await db.exec(`update public.event_settings set results_published = true where id;`)
    return true
  } catch (e) {
    return /dia da gala/.test(e.message) ? false : e.message
  }
}
ok((await tryPublish()) === false, 'sem dia da gala definido, não deixa publicar')
await db.exec(`update public.event_settings set gala_at = now() + interval '3 days' where id;`)
ok((await tryPublish()) === false, 'antes do dia da gala, não deixa publicar')
await db.exec(`update public.event_settings set gala_at = now() where id;`)
ok((await tryPublish()) === true, 'no dia da gala, deixa publicar')
await asAnon('10.6.6.6')
pub = await val(`select public.get_public_results()`)
const cat0 = pub.categories[0]
ok(pub.published && cat0.finalists.filter((f) => f.winner).length === 1 && cat0.finalists[0].winner, 'resultados publicados com vencedor')
ok(!JSON.stringify(pub).includes('"votes"'), 'resultados públicos não revelam número de votos')

// ---- reset de testes
await asUser(adminId)
r = await val(`select public.admin_reset_votes(2, 'nao')`)
ok(r.ok === false, 'reset exige confirmação')
r = await val(`select public.admin_reset_votes(2, 'APAGAR')`)
ok(r.ok === true && (await val(`select public.admin_overview()`)).phase2_voters === 0, 'reset apaga votos da fase 2')

// ---- sem empates a 2ª fase continua à espera da aprovação
r = await val(`select public.admin_reset_finalists()`)
ok(r.ok === true, 'finalistas repostos (sem votos na final)')
await asSuper()
await db.exec(`update public.event_settings set results_published = false, phase2_closes_at = null where id;`)
await db.query(`update public.vote_tallies set votes = 6 where phase = 1 and category_id = $1 and candidate_id = $2`, [c0, cands[4].id])
for (let k = 1; k <= 4; k++)
  await db.query(`update public.vote_tallies set votes = $3 where phase = 1 and category_id = $1 and candidate_id = $2`, [c1, cands[k].id, 5 + k])
await asAnon('10.7.7.7')
st = await val(`select public.get_public_state()`)
ok(st.phase === 'counting', `sem empates e com a data passada, a 2ª fase NÃO abre sem aprovação (fase: ${st.phase})`)
await asUser(adminId)
const ovReady = await val(`select public.admin_overview()`)
ok(ovReady.ties.length === 0 && ovReady.settings.finalists_confirmed === false, 'painel: sem empates, à espera da aprovação')
const sel3 = {}
for (const c of cats) {
  const rows = (await db.query(`select * from public.admin_finalist_proposal()`)).rows.filter((p) => p.category_id === c && p.status === 'qualified')
  sel3[c] = rows.map((p) => p.candidate_id).slice(0, c === c0 ? 3 : c === c1 ? 2 : 5)
}
sel3[cats[2]] = (await db.query(`select * from public.admin_finalist_proposal()`)).rows
  .filter((p) => p.category_id === cats[2])
  .slice(0, 7)
  .map((p) => p.candidate_id)
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify(sel3)])
ok(r.ok === true, 'aprovação com 3, 2, 7 e 5 finalistas em categorias diferentes')
await asAnon('10.8.8.8')
st = await val(`select public.get_public_state()`)
ok(st.phase === 'phase2', `depois da aprovação, a 2ª fase abre logo (fase: ${st.phase})`)
s = await val(`select public.start_voting_session('1020')`)
const per = (c) => s.finalists.filter((f) => f.category_id === c).length
ok(s.ok === true && per(c0) === 3 && per(c1) === 2 && per(cats[2]) === 7 && per(cats[3]) === 5, 'na 2ª fase aparecem exatamente os aprovados (3, 2, 7, 5)')

// ---- casos raros: categoria em que só 1 pessoa teve votos, ou nenhuma
await asUser(adminId)
r = await val(`select public.admin_reset_finalists()`)
ok(r.ok === true, 'finalistas repostos para os casos raros')
await asSuper()
const cx = await val(`insert into public.categories (slug, name, sort_order) values ('teste-raro', 'Prémio Teste Raro', 99) returning id`)
await db.query(`insert into public.vote_tallies values (1, $1, $2, 4)`, [cx, cands[0].id])
await asUser(adminId)
const selRare = { ...sel3, [cx]: [cands[0].id] }
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify(selRare)])
ok(r.ok === true, 'categoria em que só 1 pessoa teve votos: aprova com 1 finalista')
r = await val(`select public.admin_reset_finalists()`)
await asSuper()
await db.query(`delete from public.vote_tallies where category_id = $1`, [cx])
await asUser(adminId)
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify({ ...sel3, [cx]: [] })])
ok(r.ok === false && /não teve votos/.test(r.error), 'categoria sem votos: pede para a desativar')
await asSuper()
await db.query(`update public.categories set active = false where id = $1`, [cx])
await asUser(adminId)
r = await val(`select public.admin_set_finalists($1::jsonb)`, [JSON.stringify(sel3)])
ok(r.ok === true, 'depois de desativar a categoria sem votos, aprova normalmente')

// ---- empate no 1.º lugar da 2ª fase: os administradores escolhem o(s) vencedor(es)
await asSuper()
await db.exec(`delete from public.vote_tallies where phase = 2`)
// categoria 0: 2 empatados no topo (5 e 5) e um com 2; as outras: um vencedor claro
await db.query(`insert into public.vote_tallies values (2, $1, $2, 5), (2, $1, $3, 5), (2, $1, $4, 2)`, [c0, sel3[c0][0], sel3[c0][1], sel3[c0][2]])
for (const c of cats.filter((x) => x !== c0 && sel3[x]?.length)) await db.query(`insert into public.vote_tallies values (2, $1, $2, 7)`, [c, sel3[c][0]])
await db.exec(`update public.event_settings set phase2_closes_at = now() - interval '1 minute', gala_at = now() where id`)
await asUser(adminId)
let ovW = await val(`select public.admin_overview()`)
ok(JSON.stringify(ovW.winner_ties) === JSON.stringify([c0]), 'painel sinaliza o empate no 1.º lugar (só nessa categoria)')
let res2w = (await db.query(`select * from public.admin_results(2) where category_id = $1`, [c0])).rows
ok(res2w.filter((x) => x.is_winner).length === 0, 'antes de decidir, nenhum dos empatados aparece como vencedor')
let pubBlocked = false
try {
  await db.exec(`update public.event_settings set results_published = true where id`)
} catch (e) {
  pubBlocked = /empates no 1/.test(e.message)
}
ok(pubBlocked, 'não deixa publicar com empates por decidir')
r = await val(`select public.admin_set_winners($1, $2::jsonb)`, [c0, JSON.stringify([sel3[c0][2]])])
ok(r.ok === false, 'não deixa escolher quem não está empatado no 1.º lugar')
r = await val(`select public.admin_set_winners($1, $2::jsonb)`, [cats[3], JSON.stringify([sel3[cats[3]][0]])])
ok(r.ok === false && /não tem empate/.test(r.error), 'não deixa decidir numa categoria sem empate')
r = await val(`select public.admin_set_winners($1, $2::jsonb)`, [c0, JSON.stringify([sel3[c0][1]])])
ok(r.ok === true, 'administrador escolhe 1 vencedor entre os empatados')
ovW = await val(`select public.admin_overview()`)
res2w = (await db.query(`select * from public.admin_results(2) where category_id = $1`, [c0])).rows
ok(
  ovW.winner_ties.length === 0 &&
    res2w
      .filter((x) => x.is_winner)
      .map((x) => x.candidate_id)
      .join() === sel3[c0][1],
  'fica decidido: só o escolhido é vencedor',
)
r = await val(`select public.admin_set_winners($1, $2::jsonb)`, [c0, JSON.stringify([sel3[c0][0], sel3[c0][1]])])
ok(r.ok === false && /único vencedor/.test(r.error), 'não deixa escolher dois vencedores (há sempre um só)')
r = await val(`select public.admin_set_winners($1, $2::jsonb)`, [c0, JSON.stringify([sel3[c0][0]])])
ok(
  r.ok === true && (await db.query(`select * from public.admin_results(2) where category_id = $1 and is_winner`, [c0])).rows.length === 1,
  'pode mudar a escolha antes de publicar',
)
await db.exec(`update public.event_settings set results_published = true where id`)
await asAnon('10.9.9.9')
const pubW = await val(`select public.get_public_results()`)
ok(pubW.categories.find((k) => k.category_id === c0).finalists.filter((f) => f.winner).length === 1, 'página pública mostra o vencedor escolhido')
await asUser(adminId)
r = await val(`select public.admin_set_winners($1, $2::jsonb)`, [c0, JSON.stringify([sel3[c0][1]])])
ok(r.ok === false, 'depois de publicar, os vencedores ficam fechados')
await asSuper()
await db.exec(`update public.event_settings set results_published = false where id`)

console.log(failures ? `\n${failures} FALHA(S)` : '\nTodos os testes passaram.')
process.exit(failures ? 1 : 0)
