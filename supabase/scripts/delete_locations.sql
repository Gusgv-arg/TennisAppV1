-- Script to delete specific locations by name or ID
-- Replace 'Nombre de la locacion' with the actual name

-- Option 1: View them first to be sure
SELECT * FROM locations WHERE name LIKE '%Nombre de la locacion%';

-- Option 2: Delete by Name
-- DELETE FROM locations WHERE name = 'Nombre de la locacion';

-- Option 3: Delete by ID (Best practice)
-- DELETE FROM locations WHERE id = 'uuid-de-la-locacion';
