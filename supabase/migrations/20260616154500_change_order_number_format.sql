-- Helper function to extract initials
CREATE OR REPLACE FUNCTION public.get_initials(name_text TEXT)
RETURNS TEXT AS $$
DECLARE
  words TEXT[];
  len INT;
BEGIN
  words := regexp_split_to_array(trim(name_text), '\s+');
  len := array_length(words, 1);
  IF len IS NULL OR len = 0 THEN
    RETURN 'US'; -- Default initials
  ELSIF len = 1 THEN
    RETURN upper(substring(words[1] from 1 for 2));
  ELSE
    RETURN upper(substring(words[1] from 1 for 1)) || upper(substring(words[len] from 1 for 1));
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to compute order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_initials TEXT;
  base_id TEXT;
  final_id TEXT;
  counter INT := 0;
BEGIN
  -- Get user name
  IF NEW.created_by_user_id IS NOT NULL THEN
    SELECT name INTO user_name FROM public.users WHERE id = NEW.created_by_user_id;
  END IF;
  
  -- Fallback if name is null/empty
  IF user_name IS NULL OR user_name = '' THEN
    user_name := 'User';
  END IF;

  -- Extract initials
  user_initials := public.get_initials(user_name);

  -- Format the timestamp in Asia/Kolkata timezone: HH24MIYYYYMMDD (e.g. 165720260611)
  base_id := user_initials || to_char(timezone('Asia/Kolkata', COALESCE(NEW.created_at, now())), 'HH24MIYYYYMMDD');

  -- Ensure uniqueness (append suffix if a collision occurs)
  final_id := base_id;
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = final_id) THEN
      EXIT;
    END IF;
    counter := counter + 1;
    final_id := base_id || '-' || counter;
  END LOOP;

  NEW.order_number := final_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing default constraint
ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_order_number ON public.orders;
CREATE TRIGGER trg_generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();
