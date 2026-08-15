-- Question Categories
CREATE TABLE IF NOT EXISTS question_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name)
);

-- Question Bank
CREATE TABLE IF NOT EXISTS question_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES question_categories(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT,
    option_d TEXT,
    correct_option VARCHAR(1) NOT NULL, -- 'A', 'B', 'C', 'D'
    marks NUMERIC(5,2) DEFAULT 1.0,
    negative_marks NUMERIC(5,2) DEFAULT 0.0,
    difficulty VARCHAR(50) DEFAULT 'Medium',
    explanation TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Question Tags
CREATE TABLE IF NOT EXISTS question_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Question Bank Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS question_bank_tags (
    question_id UUID REFERENCES question_bank(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES question_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_question_bank_category ON question_bank(category_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_created_by ON question_bank(created_by);
CREATE INDEX IF NOT EXISTS idx_question_bank_tags_question ON question_bank_tags(question_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_tags_tag ON question_bank_tags(tag_id);
