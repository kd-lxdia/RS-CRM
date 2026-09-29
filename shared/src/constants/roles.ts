import { UserRole } from '../types';

export const RolePermissions: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.CALLING_STAFF]: ['read_leads', 'update_leads', 'create_calls'],
  [UserRole.SALESPERSON]: ['read_assigned_leads', 'update_assigned_leads', 'create_visits', 'create_proposals'],
  [UserRole.PROJECT_HEAD]: ['read_all_projects', 'manage_all_projects', 'approve_installations'],
  [UserRole.DOCUMENTATION]: ['read_documents', 'upload_documents', 'manage_checklists'],
  [UserRole.WAREHOUSE]: ['read_stock', 'manage_stock', 'dispatch_items'],
  [UserRole.INSTALLATION]: ['view_assigned_installations', 'update_installations'],
  [UserRole.ACCOUNTANT]: ['read_invoices', 'create_invoices', 'manage_payments'],
  [UserRole.DEALER_ADMIN]: ['manage_dealer_users', 'view_dealer_reports', 'manage_dealer_leads'],
  [UserRole.DEALER_STAFF]: ['view_dealer_leads', 'update_dealer_leads']
};
