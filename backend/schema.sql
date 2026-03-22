CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(255),
    zip_code VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    deadline DATE,
    short_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Billing / cost tracking (optional future API; UI may use localStorage until wired)
CREATE TABLE billing_entries (
    id SERIAL PRIMARY KEY,
    occurred_on DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    cost_type VARCHAR(80) NOT NULL,
    case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE case_documents (
    id SERIAL PRIMARY KEY,
    
    -- This links the file directly to a specific case. 
    -- 'ON DELETE CASCADE' means if you delete the case, its file records vanish too.
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    
    -- The original name the user saw on their computer (e.g., "Klage_Entwurf.pdf")
    original_name VARCHAR(255) NOT NULL,
    
    -- The unique name we generated in our Node.js upload route (e.g., "1710948-Klage_Entwurf.pdf")
    -- This is the exact key LocalStack needs to find the file later.
    s3_key VARCHAR(500) UNIQUE NOT NULL,
    
    -- e.g., 'application/pdf' or 'image/png' so the frontend knows how to display it
    mime_type VARCHAR(100),
    
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE case_placeholders (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    linked_s3_key VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
