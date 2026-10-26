-- Run once in the Supabase SQL editor as postgres, or via supabase db push.
begin;
create table public.finance_books (
  user_id uuid primary key references auth.users(id) on delete cascade,
  book jsonb not null check (jsonb_typeof(book) = 'object'),
  revision bigint not null check (revision > 0),
  mutation_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.finance_books enable row level security;
create policy "Read only own book" on public.finance_books
  for select to authenticated using ((select auth.uid()) = user_id);
-- All writes go through the CAS function, so a client cannot bypass revision checking.
revoke all on public.finance_books from anon, authenticated;
grant select on public.finance_books to authenticated;

create function public.save_finance_book(p_book jsonb, p_expected_revision bigint, p_mutation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_book public.finance_books%rowtype;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_mutation_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_book is null or jsonb_typeof(p_book) <> 'object'
     or octet_length(p_book::text) > 5000000 then
    raise exception 'Invalid book or revision' using errcode = '22023';
  end if;
  -- Serializes initial inserts as well as updates for this authenticated user.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into current_book from public.finance_books where user_id = actor for update;
  if found then
    -- An interrupted response may be retried safely without applying another update.
    if current_book.mutation_id = p_mutation_id then
      return jsonb_build_object('book', current_book.book, 'revision', current_book.revision,
        'mutation_id', current_book.mutation_id);
    end if;
    if current_book.revision <> p_expected_revision then
      raise exception 'Book changed on another device' using errcode = '40001';
    end if;
    update public.finance_books set book = p_book, revision = revision + 1,
      mutation_id = p_mutation_id, updated_at = now() where user_id = actor
      returning * into current_book;
  else
    if p_expected_revision <> 0 then
      raise exception 'Book missing or changed' using errcode = '40001';
    end if;
    insert into public.finance_books(user_id, book, revision, mutation_id)
      values(actor, p_book, 1, p_mutation_id) returning * into current_book;
  end if;
  return jsonb_build_object('book', current_book.book, 'revision', current_book.revision,
    'mutation_id', current_book.mutation_id);
end;
$$;
revoke all on function public.save_finance_book(jsonb, bigint, uuid) from public, anon;
grant execute on function public.save_finance_book(jsonb, bigint, uuid) to authenticated;
-- Default replica identity includes the owner primary key; RLS filters Realtime reads.
alter publication supabase_realtime add table public.finance_books;
commit;
