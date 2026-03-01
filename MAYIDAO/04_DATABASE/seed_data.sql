-- SEED DATA (For Testing)
-- Insert Admin and Test User

INSERT INTO users (username, email, points, level)
VALUES 
('admin', 'admin@mayiju.com', 9999, 'Master'),
('test_user', 'user@test.com', 10, 'Novice');

-- Insert Initial Products
-- (Optional: Products could be stored in a separate table)
-- But for now, we assume product logic is in code.
