-- Initial PostgreSQL schema. Run once against an empty database.
-- This migration does not register real model weights or change the API.
BEGIN;

CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
    password_hash text NOT NULL,
    display_name text NOT NULL,
    role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'vet', 'admin')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (email)
);

CREATE TABLE pets (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (btrim(name) <> ''),
    breed text,
    sex text NOT NULL DEFAULT 'unknown' CHECK (sex IN ('male', 'female', 'unknown')),
    birth_date date,
    birth_date_is_estimated boolean NOT NULL DEFAULT false,
    avatar_storage_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);
CREATE INDEX pets_owner_idx ON pets(owner_id);

-- Includes healthy: these are classification labels, not six diseases.
CREATE TABLE disease_classes (
    code text PRIMARY KEY,
    name_th text NOT NULL,
    name_en text NOT NULL,
    is_healthy boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE model_versions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_name text NOT NULL,
    version text NOT NULL,
    weights_storage_key text NOT NULL,
    weights_sha256 text NOT NULL CHECK (weights_sha256 ~ '^[0-9a-f]{64}$'),
    preprocessing_version text NOT NULL,
    is_finetuned boolean NOT NULL DEFAULT false,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (model_name, version)
);

-- Preserve each model's original output-index mapping across retraining.
CREATE TABLE model_version_classes (
    model_version_id bigint NOT NULL REFERENCES model_versions(id) ON DELETE RESTRICT,
    class_code text NOT NULL REFERENCES disease_classes(code) ON DELETE RESTRICT,
    output_index smallint NOT NULL CHECK (output_index >= 0),
    PRIMARY KEY (model_version_id, class_code),
    UNIQUE (model_version_id, output_index)
);
CREATE INDEX model_version_classes_class_idx ON model_version_classes(class_code);

CREATE TABLE skin_images (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pet_id bigint NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
    uploaded_by bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    storage_key text NOT NULL UNIQUE,
    original_filename text NOT NULL,
    mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    body_site text,
    captured_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skin_images_pet_date_idx ON skin_images(pet_id, created_at DESC);
CREATE INDEX skin_images_uploader_idx ON skin_images(uploaded_by);
-- Non-unique: repeat uploads may represent separate observations.
CREATE INDEX skin_images_sha256_idx ON skin_images(sha256);

CREATE TABLE analyses (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    image_id bigint NOT NULL REFERENCES skin_images(id) ON DELETE RESTRICT,
    requested_by bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requested_model_type text NOT NULL DEFAULT 'auto'
        CHECK (requested_model_type IN ('auto', 'mobilenet', 'efficientnet', 'both')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'failed')),
    symptoms text,
    guardrail_model_version text,
    guardrail_passed boolean,
    error_code text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CHECK (completed_at IS NULL OR completed_at >= created_at),
    CHECK (
        (status IN ('pending', 'processing') AND completed_at IS NULL)
        OR (status IN ('completed', 'rejected', 'failed') AND completed_at IS NOT NULL)
    ),
    CHECK (status <> 'completed' OR guardrail_passed IS TRUE)
);
CREATE INDEX analyses_image_date_idx ON analyses(image_id, created_at DESC);
CREATE INDEX analyses_requester_date_idx ON analyses(requested_by, created_at DESC);

-- One row per model used in an analysis. The selected row drives the history UI.
CREATE TABLE predictions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    analysis_id bigint NOT NULL REFERENCES analyses(id) ON DELETE RESTRICT,
    model_version_id bigint NOT NULL REFERENCES model_versions(id) ON DELETE RESTRICT,
    is_selected boolean NOT NULL DEFAULT false,
    inference_ms integer CHECK (inference_ms >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (analysis_id, model_version_id),
    UNIQUE (id, model_version_id)
);
CREATE UNIQUE INDEX predictions_one_selected_idx ON predictions(analysis_id) WHERE is_selected;
CREATE INDEX predictions_model_idx ON predictions(model_version_id);

CREATE TABLE prediction_scores (
    prediction_id bigint NOT NULL,
    model_version_id bigint NOT NULL,
    class_code text NOT NULL,
    score numeric(7,6) NOT NULL CHECK (score BETWEEN 0 AND 1),
    PRIMARY KEY (prediction_id, class_code),
    FOREIGN KEY (prediction_id, model_version_id)
        REFERENCES predictions(id, model_version_id) ON DELETE RESTRICT,
    FOREIGN KEY (model_version_id, class_code)
        REFERENCES model_version_classes(model_version_id, class_code) ON DELETE RESTRICT
);
CREATE INDEX prediction_scores_class_idx ON prediction_scores(model_version_id, class_code);

-- Feedback is separate from model output. An owner proposal is not a vet verification.
CREATE TABLE analysis_reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    analysis_id bigint NOT NULL REFERENCES analyses(id) ON DELETE RESTRICT,
    reviewer_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    proposed_class_code text NOT NULL REFERENCES disease_classes(code) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'rejected')),
    verified_by bigint REFERENCES users(id) ON DELETE RESTRICT,
    verified_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (status = 'pending' AND verified_by IS NULL AND verified_at IS NULL)
        OR (status IN ('verified', 'rejected') AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
    ),
    CHECK (verified_at IS NULL OR verified_at >= created_at)
);
CREATE INDEX analysis_reviews_analysis_idx ON analysis_reviews(analysis_id, created_at DESC);
CREATE INDEX analysis_reviews_reviewer_idx ON analysis_reviews(reviewer_id);
CREATE INDEX analysis_reviews_verifier_idx ON analysis_reviews(verified_by);
CREATE INDEX analysis_reviews_class_idx ON analysis_reviews(proposed_class_code);

-- Derive top-1 rather than duplicate the label/score in the analysis table.
-- Tie-breaking by code makes history stable when rounded scores tie.
CREATE VIEW prediction_top_results AS
SELECT DISTINCT ON (p.id)
    p.id AS prediction_id, p.analysis_id, p.model_version_id, p.is_selected,
    s.class_code, s.score
FROM predictions p
JOIN prediction_scores s ON s.prediction_id = p.id
ORDER BY p.id, s.score DESC, s.class_code;

COMMIT;
