/**
 * The integration contract lives in `@traveler-guide/types` so the admin portal
 * can use it without pulling in this package's Nest dependency. Re-exported here
 * so server-side code has one obvious import.
 */
export type {
  IntegrationDefinition,
  IntegrationField,
  IntegrationFieldStatus,
  IntegrationScope,
  IntegrationSource,
  IntegrationStatus,
  IntegrationsOverview,
  IntegrationTestResult,
} from '@traveler-guide/types';
