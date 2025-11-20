-- Supabase initial schema and RLS policies to mirror your Firestore rules
-- Run this in Supabase SQL editor or via psql connected to your Supabase DB.

-- 1) Users table (mirror auth.users + role metadata)
create table if not exists public.users (
  id uuid primary key,
  email text,
  name text,
  username text,
  role text check (role in ('admin','coordinator','teacher','student')),
  profile_picture text,
  debit_account jsonb,
  is_verified boolean default false,
  verified boolean default false,
  verification_type text,
  purchased_courses text[] default '{}',
  created_at timestamptz default now(),
  custom_user_id text
);

-- Make sure to keep this table in sync with auth.users (see notes below)

-- Enable RLS
alter table public.users enable row level security;

-- Helper function to check role of current user by looking up users table
create or replace function public.current_user_has_role(_role text)
returns boolean language sql stable as $$
  select exists(select 1 from public.users u where u.id = auth.uid() and u.role = _role);
$$;

-- Helper: check if current user has any of the provided roles
create or replace function public.current_user_has_any_role(_roles text[])
returns boolean language sql stable as $$
  select exists(select 1 from public.users u where u.id = auth.uid() and u.role = any(_roles));
$$;
-- Users: allow read if owner OR coordinator OR admin OR teacher (for teacher->teacher)
create policy users_select_owner_or_roles on public.users
  for select
  using (
    auth.uid() is not null and (
      id = auth.uid() -- owner
      or public.current_user_has_role('coordinator')
      or public.current_user_has_role('admin')
      or (public.current_user_has_role('teacher') and role = 'teacher')
    )
  );

-- Users: allow insert only if the creator is the same as the id (user creating own profile)
create policy users_insert_owner on public.users
  for insert
  with check (auth.uid() is not null and id = auth.uid());

-- Users: allow update for owner but forbid edits to sensitive fields (enforced by WITH CHECK)
-- Note: RLS policies can't reliably reference the SQL "OLD" record; instead compare
-- the attempted new values to the currently stored values via subselects.
create policy users_update_owner on public.users
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- owners may not change role, is_verified, verified, verification_type, purchased_courses
    and role = (select role from public.users where id = auth.uid())
    and is_verified = (select is_verified from public.users where id = auth.uid())
    and verified = (select verified from public.users where id = auth.uid())
    and verification_type = (select verification_type from public.users where id = auth.uid())
    and purchased_courses = (select purchased_courses from public.users where id = auth.uid())
  );

-- Users: allow coordinators to update certain fields for teachers and students
create policy users_update_coordinator on public.users
  for update
  using (public.current_user_has_role('coordinator'))
  with check (
    public.current_user_has_role('coordinator')
    -- coordinators cannot change verification_type if the current stored verification_type = 'paystack'
    and (not (
      (select verification_type from public.users where id = public.users.id) = 'paystack'
      and verification_type is distinct from (select verification_type from public.users where id = public.users.id)
    ))
  );

-- Users: allow delete only by owner or admin
create policy users_delete_owner_admin on public.users
  for delete
  using (
    auth.uid() is not null and (
      id = auth.uid() or public.current_user_has_role('admin')
    )
  );

-- 2) Courses
create table if not exists public.courses (
  id text primary key,
  title text,
  description text,
  instructor_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz
);
alter table public.courses enable row level security;

create policy courses_select_authenticated on public.courses
  for select
  using (auth.uid() is not null);

create policy courses_insert_coordinator on public.courses
  for insert
  with check (public.current_user_has_role('coordinator'));

create policy courses_update_coordinator on public.courses
  for update
  using (public.current_user_has_role('coordinator'));

create policy courses_delete_admin_teacher on public.courses
  for delete
  using (
    public.current_user_has_role('admin') OR (public.current_user_has_role('teacher') AND instructor_id = auth.uid())
  );

-- 3) Enrollments
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.users(id),
  course_id text references public.courses(id),
  enrolled_at timestamptz default now(),
  verified boolean default false
);
alter table public.enrollments enable row level security;

create policy enrollments_select_owner_or_staff on public.enrollments
  for select
  using (
    auth.uid() is not null and (
      student_id = auth.uid() or public.current_user_has_role('coordinator') or public.current_user_has_role('teacher') or public.current_user_has_role('admin')
    )
  );

create policy enrollments_insert_authenticated on public.enrollments
  for insert
  with check (auth.uid() is not null and student_id = auth.uid());

create policy enrollments_update_coordinator on public.enrollments
  for update
  using (public.current_user_has_role('coordinator'));

create policy enrollments_delete_owner_admin on public.enrollments
  for delete
  using (auth.uid() is not null and (student_id = auth.uid() or public.current_user_has_role('admin')));

-- 4) Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  course_id text references public.courses(id),
  amount numeric,
  currency text default 'NGN',
  reference text,
  status text,
  email text,
  created_at timestamptz default now(),
  verified_at timestamptz
);
alter table public.payments enable row level security;

create policy payments_select_owner_or_staff on public.payments
  for select
  using (auth.uid() is not null and (user_id = auth.uid() or public.current_user_has_role('coordinator') or public.current_user_has_role('admin')));

create policy payments_insert_owner on public.payments
  for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and course_id is not null
    and amount is not null
    and reference is not null
    and status is not null
    and email = (select email from public.users u where u.id = auth.uid())
  );

create policy payments_update_owner_admin on public.payments
  for update
  using (auth.uid() is not null and (user_id = auth.uid() or public.current_user_has_role('admin')));

create policy payments_delete_admin on public.payments
  for delete
  using (public.current_user_has_role('admin'));

-- 5) CBT Questions
create table if not exists public.cbt_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.users(id),
  course_id text references public.courses(id),
  question text,
  options jsonb,
  correct_answer text,
  created_at timestamptz default now()
);
alter table public.cbt_questions enable row level security;

create policy cbt_questions_select_auth on public.cbt_questions
  for select
  using (auth.uid() is not null);

create policy cbt_questions_insert_teacher_or_coordinator on public.cbt_questions
  for insert
  with check (auth.uid() is not null and (teacher_id = auth.uid() or public.current_user_has_role('coordinator') or public.current_user_has_role('admin')));

create policy cbt_questions_update_teacher_or_coordinator on public.cbt_questions
  for update
  using (auth.uid() is not null and (teacher_id = auth.uid() or public.current_user_has_role('coordinator') or public.current_user_has_role('admin')));

create policy cbt_questions_delete_teacher_or_admin on public.cbt_questions
  for delete
  using (auth.uid() is not null and (teacher_id = auth.uid() or public.current_user_has_role('admin')));

-- 6) CBT Exams
create table if not exists public.cbt_exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.users(id),
  course_id text references public.courses(id),
  title text,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);
alter table public.cbt_exams enable row level security;

create policy cbt_exams_select_auth on public.cbt_exams
  for select
  using (auth.uid() is not null);

create policy cbt_exams_insert_teacher_or_coordinator on public.cbt_exams
  for insert
  with check (auth.uid() is not null and (teacher_id = auth.uid() or public.current_user_has_role('coordinator') or public.current_user_has_role('admin')));

create policy cbt_exams_update_teacher_or_coordinator on public.cbt_exams
  for update
  using (auth.uid() is not null and (teacher_id = auth.uid() or public.current_user_has_role('coordinator') or public.current_user_has_role('admin')));

create policy cbt_exams_delete_teacher_or_admin on public.cbt_exams
  for delete
  using (auth.uid() is not null and (teacher_id = auth.uid() or public.current_user_has_role('admin')));

-- 7) Exam Attempts
create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.cbt_exams(id),
  student_id uuid references public.users(id),
  answers jsonb,
  score numeric,
  status text,
  created_at timestamptz default now()
);
alter table public.exam_attempts enable row level security;

create policy exam_attempts_select on public.exam_attempts
  for select
  using (auth.uid() is not null and (
    (public.current_user_has_role('student') and student_id = auth.uid())
    or public.current_user_has_role('teacher') or public.current_user_has_role('coordinator') or public.current_user_has_role('admin')
  ));

create policy exam_attempts_insert_student on public.exam_attempts
  for insert
  with check (auth.uid() is not null and public.current_user_has_role('student') and student_id = auth.uid());

create policy exam_attempts_update_staff on public.exam_attempts
  for update
  using (auth.uid() is not null and (public.current_user_has_role('teacher') or public.current_user_has_role('coordinator') or public.current_user_has_role('admin')));

create policy exam_attempts_delete_admin on public.exam_attempts
  for delete
  using (public.current_user_has_role('admin'));

-- 8) AI API Keys
create table if not exists public.ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  coordinator_id uuid references public.users(id),
  name text,
  provider text,
  key_metadata jsonb,
  created_at timestamptz default now()
);
alter table public.ai_api_keys enable row level security;

create policy ai_api_keys_select_coordinator_admin on public.ai_api_keys
  for select
  using (auth.uid() is not null and (coordinator_id = auth.uid() or public.current_user_has_role('admin')));

create policy ai_api_keys_insert_coordinator on public.ai_api_keys
  for insert
  with check (auth.uid() is not null and coordinator_id = auth.uid());

create policy ai_api_keys_update_coordinator on public.ai_api_keys
  for update
  using (auth.uid() is not null and coordinator_id = auth.uid());

create policy ai_api_keys_delete_coordinator_admin on public.ai_api_keys
  for delete
  using (auth.uid() is not null and (coordinator_id = auth.uid() or public.current_user_has_role('admin')));

-- Indexes (suggested)
create index if not exists idx_enrollments_student on public.enrollments(student_id, enrolled_at desc);
create index if not exists idx_teacher_reviews_teacher_created on public.courses(id);

-- Notes:
-- 1) Syncing auth.users -> public.users: recommend a trigger or a background worker that inserts/updates a row in public.users when a new auth user is created. Supabase provides auth hooks (see "Database > Replication" or Postgres function to copy from auth.users).
-- 2) Policies above assume you will maintain roles in public.users.role. For example, when a user signs up, insert a corresponding public.users row with role 'student' by default.
-- 3) For email checks (payments_insert_owner), the policy compares email to the email stored in public.users. Keep that column synced.
-- 4) Test policies carefully in Supabase SQL editor and use the "Policies" debug tools in Supabase to simulate roles.

-- End of migration
