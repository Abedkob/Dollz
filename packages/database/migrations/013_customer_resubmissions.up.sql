ALTER TABLE order_revisions DROP CONSTRAINT order_revisions_revision_type_check;
ALTER TABLE order_revisions ADD CONSTRAINT order_revisions_revision_type_check
  CHECK (revision_type IN ('CHANGES_REQUESTED', 'PRICE_PROPOSAL', 'APPROVAL', 'REJECTION', 'CUSTOMER_RESUBMISSION'));
