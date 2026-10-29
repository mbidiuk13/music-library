CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE
    users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    track (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        genre VARCHAR(100) NOT NULL,
        bpm INT NOT NULL CHECK (bpm > 0),
        key_signature VARCHAR(20) NOT NULL,
        mood VARCHAR(50) NOT NULL,
        year INT NOT NULL CHECK (year > 0),
        s3_key VARCHAR(512) NOT NULL,
        play_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    playlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, title)
    );

CREATE TABLE
    playlist_track (
        playlist_id UUID NOT NULL REFERENCES playlist (id) ON DELETE CASCADE,
        track_id UUID NOT NULL REFERENCES track (id) ON DELETE CASCADE,
        added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (playlist_id, track_id)
    );

CREATE TABLE
    user_listen_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        track_id UUID NOT NULL REFERENCES track (id) ON DELETE CASCADE,
        listened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX idx_track_title_trgm ON track USING gin (title gin_trgm_ops);

CREATE INDEX idx_track_artist_trgm ON track USING gin (artist gin_trgm_ops);

CREATE INDEX idx_track_genre ON track (genre);

CREATE INDEX idx_track_play_count ON track (play_count DESC);

CREATE INDEX idx_history_user ON user_listen_history (user_id, listened_at DESC);