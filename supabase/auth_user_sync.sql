-- Supabase SQL for Online Learning Portal
-- Creates schema + RLS policies approximating Firebase rules
-- Paste & run in Supabase SQL editor (Project -> SQL Editor -> New Query -> Run)

-- 1) Enable pgcrypto for uuid generation
create extension if not exists "pgcrypto";

-- 2) Roles table + user_roles (many-to-many)
create table if not exists roles (
  id uuid default gen_random_uuid() primary key,
  name text unique not null -- 'admin','coordinator','teacher','student'
);

create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  auth_uid uuid,                 -- set this to auth.uid() after signup (link to Supabase Auth)
  email text unique,
  display_name text,
  phone text,
  created_at timestamptz default now(),
  profile jsonb default '{}'
);

create table if not exists user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade,
  role_id uuid references roles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, role_id)
);

-- 3) Role-specific profiles (store only extra fields)
create table if not exists teachers (
  id uuid references users(id) primary key,
  bio text,
  approved boolean default false,
  rating numeric(3,2) default 0,
  meta jsonb default '{}'
);

create table if not exists students (
  id uuid references users(id) primary key,
  verified boolean default false,
  meta jsonb default '{}'
);

create table if not exists coordinators (
  id uuid references users(id) primary key,
  meta jsonb default '{}'
);

-- 4) Core domain tables: courses, lessons, enrollments
create table if not exists courses (
  id uuid default gen_random_uuid() primary key,
  slug text unique,
  title text not null,
  description text,
  teacher_id uuid references teachers(id) on delete set null,
  price numeric default 0,
  published boolean default false,
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

create table if not exists lessons (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references courses(id) on delete cascade,
  title text not null,
  body text,
  order_index int default 0,
  created_at timestamptz default now()
);

create table if not exists enrollments (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references students(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  started_at timestamptz default now(),
  completed boolean default false,
  unique(student_id, course_id)
);

-- 5) CBT: questions, exams, student answers, results
create table if not exists cbt_exams (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references courses(id) on delete cascade,
  title text,
  duration_minutes int default 0,
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

create table if not exists cbt_questions (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references cbt_exams(id) on delete cascade,
  question text not null,
  choices jsonb default '[]', -- array of choices
  answer jsonb,               -- authoritative answer (stored encrypted/nullable)
  points int default 1,
  created_at timestamptz default now()
);

create table if not exists cbt_attempts (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references cbt_exams(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  started_at timestamptz default now(),
  finished_at timestamptz,
  score numeric default 0,
  metadata jsonb default '{}'
);

create table if not exists cbt_answers (
  id uuid default gen_random_uuid() primary key,
  attempt_id uuid references cbt_attempts(id) on delete cascade,
  question_id uuid references cbt_questions(id) on delete cascade,
  answer jsonb,
  correct boolean,
  points_awarded int default 0,
  created_at timestamptz default now()
);

-- 6) Payments, access codes, verifications
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete set null,
  course_id uuid references courses(id) on delete set null,
  amount numeric not null,
  provider text,
  provider_reference text,
  status text default 'pending', -- pending, success, failed, refunded
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

create table if not exists access_codes (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  course_id uuid references courses(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  redeemed_by uuid references users(id) on delete set null,
  redeemed_at timestamptz
);

-- 7) Administrative: logs, notices, teacher applications, reviews, certificates
create table if not exists system_logs (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references users(id) on delete set null,
  action text,
  resource jsonb,
  created_at timestamptz default now()
);

create table if not exists notices (
  id uuid default gen_random_uuid() primary key,
  title text,
  body text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists teacher_applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade,
  resume_url text,
  status text default 'pending', -- pending, approved, rejected
  submitted_at timestamptz default now(),
  processed_at timestamptz
);

create table if not exists student_reviews (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references students(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete cascade,
  rating int check (rating>=1 and rating<=5),
  comment text,
  created_at timestamptz default now()
);

create table if not exists certificates (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references students(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  issued_at timestamptz default now(),
  data jsonb
);

-- 8) Seed basic roles
insert into roles (name) values ('admin') on conflict (name) do nothing;
insert into roles (name) values ('coordinator') on conflict (name) do nothing;
insert into roles (name) values ('teacher') on conflict (name) do nothing;
insert into roles (name) values ('student') on conflict (name) do nothing;

-- 9) Helper functions to check role membership
create or replace function is_in_role(uid uuid, r text) returns boolean as $$
  select exists(
    select 1 from user_roles ur join roles r2 on ur.role_id = r2.id
    where ur.user_id = uid and r2.name = r limit 1
  );
$$ language sql stable;

-- 10) Link Supabase auth uid to users table automatically (trigger)
-- NOTE: You'll need to set users.auth_uid after a user registers, or use a Postgres function
-- that reads jwt.claims sub. Example trigger below expects incoming users inserted by server

-- 11) Row Level Security: enable and set default deny

-- Enable RLS on all tables where applicable
alter table users enable row level security;
alter table user_roles enable row level security;
alter table teachers enable row level security;
alter table students enable row level security;
alter table coordinators enable row level security;
alter table roles enable row level security;
alter table courses enable row level security;
alter table lessons enable row level security;
alter table enrollments enable row level security;
alter table cbt_exams enable row level security;
alter table cbt_questions enable row level security;
alter table cbt_attempts enable row level security;
alter table cbt_answers enable row level security;
alter table payments enable row level security;
alter table access_codes enable row level security;
alter table system_logs enable row level security;
alter table notices enable row level security;
alter table teacher_applications enable row level security;
alter table student_reviews enable row level security;
alter table certificates enable row level security;

-- 12) Policies (broad mapping from your Firebase rules)

-- USERS: users can read their own profile; admins can read all; anyone can create (signup)
create policy "users_insert_auth" on users for insert
  using (auth.role() is not null)
  with check (auth.role() is not null);

create policy "users_select_own_or_admin" on users for select
  using (
    auth.uid()::text = auth_uid::text
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
  );

create policy "users_update_own" on users for update
  using (auth.uid()::text = auth_uid::text)
  with check (auth.uid()::text = auth_uid::text);

create policy "users_delete_admin_only" on users for delete
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

-- ROLES / USER_ROLES: admin manages roles; users can see their roles
create policy "roles_select_admin_only" on roles for select
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "user_roles_manage_admin_only" on user_roles for insert, update, delete
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "user_roles_select_own" on user_roles for select
  using (
    (select user_id from user_roles ur where ur.id = user_roles.id) = (select id from users where auth_uid = auth.uid())
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
  );

-- TEACHERS/STUDENTS (profiles)
create policy "teachers_select_public_or_owner_or_admin" on teachers for select
  using (
    is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
    or id = (select id from users where auth_uid = auth.uid())
  );
create policy "teachers_update_owner_or_admin" on teachers for update
  using (id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))
  with check (id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "students_select_owner_or_admin" on students for select
  using (id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));
create policy "students_update_owner" on students for update
  using (id = (select id from users where auth_uid = auth.uid()))
  with check (id = (select id from users where auth_uid = auth.uid()));

-- COURSES: teachers (owner) create/update their courses; admins can manage; students can read published courses
create policy "courses_insert_teacher_or_admin" on courses for insert
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'teacher') or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'teacher') or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "courses_select_published_or_owner_or_admin" on courses for select
  using (
    published = true
    or teacher_id = (select id from teachers where id = (select id from users where auth_uid = auth.uid()))
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
  );

create policy "courses_update_owner_or_admin" on courses for update
  using (teacher_id = (select id from teachers where id = (select id from users where auth_uid = auth.uid())) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))
  with check (teacher_id = (select id from teachers where id = (select id from users where auth_uid = auth.uid())) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "courses_delete_admin_only" on courses for delete
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

-- LESSONS: created by teacher of the course or admin
create policy "lessons_insert_by_course_teacher_or_admin" on lessons for insert
  using (exists(select 1 from courses c where c.id = course_id and (c.teacher_id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))))
  with check (exists(select 1 from courses c where c.id = course_id and (c.teacher_id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))));

create policy "lessons_select_course_published_or_admin" on lessons for select
  using (
    exists(select 1 from courses c where c.id = course_id and c.published = true)
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
  );

-- ENROLLMENTS: students enroll themselves; teachers/admin can view enrollments for their courses
create policy "enrollments_insert_student_only" on enrollments for insert
  using (student_id = (select id from users where auth_uid = auth.uid()))
  with check (student_id = (select id from users where auth_uid = auth.uid()));

create policy "enrollments_select_student_or_teacher_or_admin" on enrollments for select
  using (
    student_id = (select id from users where auth_uid = auth.uid())
    or exists(select 1 from courses c where c.id = course_id and c.teacher_id = (select id from users where auth_uid = auth.uid()))
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
  );

-- CBT: teachers create exams/questions; students create attempts/answers; scores readable by owner and teacher/admin
create policy "cbt_exams_manage_teacher_or_admin" on cbt_exams for insert, update, delete
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'teacher') or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'teacher') or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "cbt_questions_manage_teacher_or_admin" on cbt_questions for insert, update, delete
  using (exists(select 1 from cbt_exams e join courses c on e.course_id = c.id where e.id = exam_id and (c.teacher_id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))))
  with check (exists(select 1 from cbt_exams e join courses c on e.course_id = c.id where e.id = exam_id and (c.teacher_id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))));

create policy "cbt_attempts_insert_student" on cbt_attempts for insert
  using (student_id = (select id from users where auth_uid = auth.uid()))
  with check (student_id = (select id from users where auth_uid = auth.uid()));

create policy "cbt_attempts_select_owner_or_teacher_or_admin" on cbt_attempts for select
  using (
    student_id = (select id from users where auth_uid = auth.uid())
    or exists(select 1 from cbt_exams e join courses c on e.course_id = c.id where e.id = exam_id and c.teacher_id = (select id from users where auth_uid = auth.uid()))
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
  );

create policy "cbt_answers_insert_owner" on cbt_answers for insert
  using (exists(select 1 from cbt_attempts a where a.id = attempt_id and a.student_id = (select id from users where auth_uid = auth.uid())))
  with check (exists(select 1 from cbt_attempts a where a.id = attempt_id and a.student_id = (select id from users where auth_uid = auth.uid())));

create policy "cbt_answers_select_owner_or_teacher_or_admin" on cbt_answers for select
  using (
    exists(select 1 from cbt_attempts a where a.id = attempt_id and a.student_id = (select id from users where auth_uid = auth.uid()))
    or exists(select 1 from cbt_attempts a join cbt_exams e on a.exam_id = e.id join courses c on e.course_id = c.id where a.attempt_id = cbt_answers.attempt_id and c.teacher_id = (select id from users where auth_uid = auth.uid()))
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
  );

-- PAYMENTS: users can insert their own payments; admin/coordinator can view and update
create policy "payments_insert_owner" on payments for insert
  using (user_id = (select id from users where auth_uid = auth.uid()))
  with check (user_id = (select id from users where auth_uid = auth.uid()));

create policy "payments_select_owner_or_admin_or_coordinator" on payments for select
  using (
    user_id = (select id from users where auth_uid = auth.uid())
    or is_in_role((select id from users where auth_uid = auth.uid()), 'admin')
    or is_in_role((select id from users where auth_uid = auth.uid()), 'coordinator')
  );

create policy "payments_update_admin_or_coordinator" on payments for update
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin') or is_in_role((select id from users where auth_uid = auth.uid()), 'coordinator'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'admin') or is_in_role((select id from users where auth_uid = auth.uid()), 'coordinator'));

-- ACCESS CODES: admins create; students can redeem (update redeemed_by)
create policy "access_codes_insert_admin" on access_codes for insert
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "access_codes_update_redeem_owner" on access_codes for update
  using (redeemed_by = (select id from users where auth_uid = auth.uid()) or redeemed_by is null)
  with check ((redeemed_by = (select id from users where auth_uid = auth.uid()) and redeemed_at is not null) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

-- SYSTEM LOGS: only admin can read/write
create policy "system_logs_admin_only" on system_logs for all
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

-- NOTICES: admins and coordinators can create; public can read
create policy "notices_insert_admin_or_coord" on notices for insert
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin') or is_in_role((select id from users where auth_uid = auth.uid()), 'coordinator'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'admin') or is_in_role((select id from users where auth_uid = auth.uid()), 'coordinator'));

create policy "notices_select_public" on notices for select
  using (true);

-- TEACHER APPLICATIONS: anyone can insert; admin/coordinator can update
create policy "teacher_applications_insert_anyone" on teacher_applications for insert
  using (true)
  with check (true);

create policy "teacher_applications_manage_admin_coord" on teacher_applications for update, delete
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'admin') or is_in_role((select id from users where auth_uid = auth.uid()), 'coordinator'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'admin') or is_in_role((select id from users where auth_uid = auth.uid()), 'coordinator'));

-- REVIEWS: students can create reviews for teachers; read is public
create policy "student_reviews_insert_owner" on student_reviews for insert
  using (student_id = (select id from users where auth_uid = auth.uid()))
  with check (student_id = (select id from users where auth_uid = auth.uid()));

create policy "student_reviews_select_public" on student_reviews for select
  using (true);

-- CERTIFICATES: admin or teacher can issue; students can read their certificates
create policy "certificates_insert_teacher_or_admin" on certificates for insert
  using (is_in_role((select id from users where auth_uid = auth.uid()), 'teacher') or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'))
  with check (is_in_role((select id from users where auth_uid = auth.uid()), 'teacher') or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

create policy "certificates_select_owner_or_admin" on certificates for select
  using (student_id = (select id from users where auth_uid = auth.uid()) or is_in_role((select id from users where auth_uid = auth.uid()), 'admin'));

-- 13) Final note: Supabase Auth claims and linking
-- In your backend (edge function or server), after signup, insert a users row linking auth_uid = auth.uid() so policies above can resolve the user.
-- Example: when a user signs up, insert into users (auth_uid,email,display_name) values (auth.uid(), 'someone@example.com','Name') returning id;

-- 14) Convenience view: map auth.uid() to users.id
create or replace view current_user as
select u.* from users u where u.auth_uid = auth.uid();

-- Done

-- Uploaded screenshot path (for your reference in this project): /mnt/data/Screenshot (105).png
