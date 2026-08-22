import { Router } from 'express';
import { protect, requirePermission } from '../../middleware/auth.middleware';
import { protectCustomer } from '../../middleware/customerAuth.middleware';
import * as notificationsController from './notifications.controller';

const router = Router();

// ----- Customer Routes -----
router.post('/customer/register-token', protectCustomer, notificationsController.registerCustomerToken);
router.get('/customer/mine', protectCustomer, notificationsController.getMyCustomerNotifications);
router.patch('/customer/:id/read', protectCustomer, notificationsController.markAsRead);
router.delete('/customer/:id', protectCustomer, notificationsController.deleteCustomerNotification);
router.post('/customer/bulk-delete', protectCustomer, notificationsController.bulkDeleteCustomerNotifications);

// ----- Admin Public & Personal Routes -----
router.post('/admin/register-token', protect, notificationsController.registerAdminToken);
router.get('/admin/mine', protect, notificationsController.getMyAdminNotifications);
router.patch('/admin/:id/read', protect, notificationsController.markAsRead);

// ----- Admin Configuration & Management Routes -----
router.get('/admin/configs', protect, requirePermission('manage_settings'), notificationsController.listNotificationConfigs);
router.patch('/admin/configs/:id', protect, requirePermission('manage_settings'), notificationsController.updateNotificationConfig);

router.get('/admin/manager-settings', protect, requirePermission('manage_settings'), notificationsController.getNotificationManagerSettings);
router.patch('/admin/manager-settings', protect, requirePermission('manage_settings'), notificationsController.updateNotificationManagerSettings);
router.get('/admin/roles-list', protect, requirePermission('manage_settings'), notificationsController.listNotificationRoles);

router.get('/admin/templates', protect, requirePermission('manage_settings'), notificationsController.listNotificationTemplates);
router.get('/admin/templates/whatsapp-approved', protect, requirePermission('manage_settings'), notificationsController.listApprovedWhatsAppTemplates);
router.put('/admin/templates/:type/:channel', protect, requirePermission('manage_settings'), notificationsController.updateNotificationTemplate);

router.get('/admin/logs', protect, requirePermission('manage_settings'), notificationsController.listNotifications);
router.delete('/admin/logs/:id', protect, requirePermission('manage_settings'), notificationsController.deleteLog);
router.post('/admin/logs/bulk-delete', protect, requirePermission('manage_settings'), notificationsController.bulkDeleteLogs);

// Keep older compatibility endpoints
router.get('/admin/all', protect, requirePermission('manage_settings'), notificationsController.getAllSystemNotifications);
router.post('/admin/send-manual', protect, requirePermission('manage_settings'), notificationsController.sendManualNotification);
router.delete('/admin/:id', protect, requirePermission('manage_settings'), notificationsController.deleteNotification);

export default router;
