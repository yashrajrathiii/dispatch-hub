-- 1. Create a function to backfill existing check clearances and buyers
DO $$
DECLARE
  r RECORD;
  v_buyer_id UUID;
BEGIN
  -- Insert missing buyers for any existing check clearances (case-insensitive match)
  FOR r IN 
    SELECT DISTINCT party_name 
    FROM public.check_clearances c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.buyers b WHERE lower(b.name) = lower(c.party_name)
    )
  LOOP
    INSERT INTO public.buyers (name, is_active)
    VALUES (r.party_name, true);
  END LOOP;

  -- Update buyer_id on all existing check clearances that aren't linked yet
  UPDATE public.check_clearances c
  SET buyer_id = b.id
  FROM public.buyers b
  WHERE lower(b.name) = lower(c.party_name) AND c.buyer_id IS NULL;
END $$;

-- 2. Create the trigger function for auto-creating and linking buyers
CREATE OR REPLACE FUNCTION public.handle_check_clearance_party()
RETURNS TRIGGER AS $$
DECLARE
  v_buyer_id UUID;
BEGIN
  -- Search for an existing buyer (case-insensitive)
  SELECT id INTO v_buyer_id
  FROM public.buyers
  WHERE lower(name) = lower(NEW.party_name)
  LIMIT 1;

  -- If not found, create a new buyer
  IF v_buyer_id IS NULL THEN
    INSERT INTO public.buyers (name, is_active)
    VALUES (NEW.party_name, true)
    RETURNING id INTO v_buyer_id;
  END IF;

  -- Link the buyer_id
  NEW.buyer_id := v_buyer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind the trigger to check_clearances
DROP TRIGGER IF EXISTS on_check_clearance_party_insert ON public.check_clearances;
CREATE TRIGGER on_check_clearance_party_insert
  BEFORE INSERT OR UPDATE OF party_name ON public.check_clearances
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_check_clearance_party();
