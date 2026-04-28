-- Rename current_phase → phase to match application code
ALTER TABLE sessions RENAME COLUMN current_phase TO phase;
