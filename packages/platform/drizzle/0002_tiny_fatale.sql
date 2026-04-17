ALTER TABLE `payments`
  ADD `risk_decision` varchar(16) NOT NULL DEFAULT 'pass',
  ADD `risk_reason` text,
  ADD `risk_checked_at` timestamp;

CREATE INDEX `idx_risk_decision_created` ON `payments` (`risk_decision`,`created_at`);