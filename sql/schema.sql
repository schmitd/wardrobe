-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the wardrobe_items table
create table wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(), -- Assuming you use Supabase Auth, otherwise remove default
  image_url text not null,
  category text,
  description text,
  style_tags text[],
  embedding vector(768), -- Dimensions for text-embedding-004
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a function to search for wardrobe items
create or replace function match_wardrobe_items (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  image_url text,
  category text,
  description text,
  style_tags text[],
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    wardrobe_items.id,
    wardrobe_items.image_url,
    wardrobe_items.category,
    wardrobe_items.description,
    wardrobe_items.style_tags,
    1 - (wardrobe_items.embedding <=> query_embedding) as similarity
  from wardrobe_items
  where 1 - (wardrobe_items.embedding <=> query_embedding) > match_threshold
  order by wardrobe_items.embedding <=> query_embedding
  limit match_count;
end;
$$;
