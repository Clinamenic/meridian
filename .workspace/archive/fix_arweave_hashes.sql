-- Fix Arweave hashes storage issue
-- Move Arweave transaction IDs from title/location_value to arweave_hashes column

-- Update resources where title contains Arweave transaction ID
UPDATE resources 
SET arweave_hashes = json_array(
  json_object(
    'hash', substr(title, 12), -- Remove 'arweave.net/' prefix
    'timestamp', indexed_at,
    'link', location_value,
    'tags', json_array()
  )
)
WHERE title LIKE 'arweave.net/%' 
  AND (arweave_hashes IS NULL OR arweave_hashes = '');

-- Update resources where location_value contains Arweave transaction ID but title doesn't
UPDATE resources 
SET arweave_hashes = json_array(
  json_object(
    'hash', substr(location_value, 26), -- Remove 'https://arweave.net/' prefix
    'timestamp', indexed_at,
    'link', location_value,
    'tags', json_array()
  )
)
WHERE location_value LIKE 'https://arweave.net/%' 
  AND title NOT LIKE 'arweave.net/%'
  AND (arweave_hashes IS NULL OR arweave_hashes = '');

-- Show the results
SELECT id, title, location_value, arweave_hashes 
FROM resources 
WHERE arweave_hashes IS NOT NULL AND arweave_hashes != ''
LIMIT 5; 