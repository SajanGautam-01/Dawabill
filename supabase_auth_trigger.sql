-- ==============================================================================
-- DAWABILL AUTHENTICATION TRIGGER
-- Automatically creates a Store and Public User profile when someone signs up
-- ==============================================================================

-- 1. Create the function that executes securely with elevated privileges
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_store_id UUID;
BEGIN
  -- Atomic Transaction Scope Begins Here

  -- Step A: Auto-generate a new Store for this tenant
  -- We extract 'store_name' from the signup metadata if provided, otherwise fallback
  INSERT INTO public.stores (name, address, gst_no)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'store_name', 'My Medical Store'), 
    NULL, 
    NULL
  )
  RETURNING id INTO new_store_id;

  -- Step B: Auto-generate the user profile linked to the new store
  -- The first user of this new store is naturally assigned the 'admin' role
  INSERT INTO public.users (id, store_id, name, email, role)
  VALUES (
    new.id, -- the auth.uid()
    new_store_id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Store Admin'),
    new.email,
    'admin' 
  );

  -- Return the new user record for Supabase Auth to complete the signup
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Create the Trigger on the protected auth.users table
-- First, drop if it already exists to prevent duplication errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Bind the function to execute AFTER every successful signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
