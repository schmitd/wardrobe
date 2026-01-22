create or replace function get_dissimilar_items (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id text
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
set search_path = public, extensions
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
  where wardrobe_items.user_id = p_user_id
    and 1 - (wardrobe_items.embedding <=> query_embedding) < match_threshold
  order by similarity asc
  limit match_count;
end;
$$;
