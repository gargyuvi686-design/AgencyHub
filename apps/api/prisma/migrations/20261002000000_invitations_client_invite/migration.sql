-- Phase 4A: Extend invitations table for client portal invites
-- Adds: client_id (nullable FK), created_by (user who sent invite)
-- Changes: token_hash from VARCHAR(255) to VARCHAR(64) (SHA-256 hex is always 64 chars)
-- Adds: CLIENT to InvitationRole enum
-- Adds: email index for fast lookup by invited email

-- Extend InvitationRole enum to include CLIENT portal invites
ALTER TABLE `invitations` MODIFY COLUMN `role` ENUM('AGENCY_ADMIN', 'AGENCY_MEMBER', 'CLIENT') NOT NULL;

-- Add client_id (nullable — only set for CLIENT-role invitations)
ALTER TABLE `invitations` ADD COLUMN `client_id` CHAR(36) NULL AFTER `role`;

-- Resize token_hash to exact SHA-256 hex length (64 chars)
ALTER TABLE `invitations` MODIFY COLUMN `token_hash` VARCHAR(64) NOT NULL;

-- Add created_by (user id of the agency admin who sent the invite)
ALTER TABLE `invitations` ADD COLUMN `created_by` CHAR(36) NOT NULL DEFAULT '' AFTER `used_at`;

-- Remove the DEFAULT once column exists (MySQL requires DEFAULT for NOT NULL ADD COLUMN)
ALTER TABLE `invitations` ALTER COLUMN `created_by` DROP DEFAULT;

-- Add email index for fast "is this email already invited?" lookups
CREATE INDEX `invitations_email_idx` ON `invitations`(`email`);
