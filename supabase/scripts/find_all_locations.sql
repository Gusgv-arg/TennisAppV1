-- Script to find ALL locations and see which academy they belong to
SELECT 
  l.id, 
  l.name as location_name, 
  l.academy_id, 
  a.name as academy_name,
  a.id as academy_id_check
FROM locations l
LEFT JOIN academies a ON l.academy_id = a.id;
