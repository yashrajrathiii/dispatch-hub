-- Update default value for unit column to 'CB'
ALTER TABLE public.products ALTER COLUMN unit SET DEFAULT 'CB';

-- Update existing products with unit 'pcs' to 'CB'
UPDATE public.products SET unit = 'CB' WHERE unit = 'pcs';
