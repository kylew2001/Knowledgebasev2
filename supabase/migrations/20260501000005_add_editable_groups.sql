alter type public.audit_action add value if not exists 'group_created';
alter type public.audit_action add value if not exists 'group_updated';
alter type public.audit_action add value if not exists 'group_deleted';

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.groups(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_not_blank check (length(trim(name)) > 0),
  constraint groups_not_own_parent check (parent_id is null or parent_id <> id)
);

create unique index if not exists groups_root_name_unique
on public.groups (lower(name))
where parent_id is null;

create unique index if not exists groups_child_name_unique
on public.groups (parent_id, lower(name))
where parent_id is not null;

create index if not exists groups_parent_id_idx on public.groups(parent_id);

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

alter table public.groups enable row level security;

drop policy if exists "groups_view_all_authenticated" on public.groups;
create policy "groups_view_all_authenticated"
on public.groups for select
to authenticated
using (true);

drop policy if exists "groups_admin_write" on public.groups;
create policy "groups_admin_write"
on public.groups for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

with root_groups(name, description) as (
  values
    ('Warehouse', 'Warehouse operations and floor teams'),
    ('Purchasing', 'Purchasing and procurement'),
    ('Finance', 'Finance and accounts'),
    ('Sales', 'Sales team'),
    ('IT', 'Information technology')
)
insert into public.groups (name, description)
select name, description
from root_groups
on conflict do nothing;

with warehouse as (
  select id from public.groups where parent_id is null and name = 'Warehouse' limit 1
),
subgroups(name, description) as (
  values
    ('Inwards', 'Inbound goods and receiving'),
    ('Dispatch', 'Outbound orders and dispatch'),
    ('Inventory Control', 'Stock accuracy and inventory control'),
    ('Supervisor', 'Warehouse supervisors')
)
insert into public.groups (parent_id, name, description)
select warehouse.id, subgroups.name, subgroups.description
from warehouse
cross join subgroups
on conflict do nothing;
