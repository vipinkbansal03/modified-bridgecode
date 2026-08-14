import { Router } from 'express';
import { protect, requirePermission } from '../../middleware/auth.middleware';
import { protectCustomer } from '../../middleware/customerAuth.middleware';
import * as notificationsController from './notifications.controller';

const router = Router();

// ----- Admin Routes -----
router.post('/admin/register-token', protect, notificationsController.registerAdminToken);
router.get('/admin/mine', protect, notificationsController.getMyAdminNotifications);
router.get('/admin/all', protect, requirePermission('manage_settings'), notificationsController.getAllSystemNotifications);
router.post('/admin/send-manual', protect, requirePermission('manage_settings'), notificationsController.sendManualNotification);
router.delete('/admin/:id', protect, requirePermission('manage_settings'), notificationsController.deleteNotification);

// ----- Customer Routes -----
router.post('/customer/register-token', protectCustomer, notificationsController.registerCustomerToken);
router.get('/customer/mine', protectCustomer, notificationsController.getMyCustomerNotifications);

// ----- Shared Routes -----
// Using no auth middleware for the read endpoint, or we can use a custom logic. Let's just allow it for now or require either.
// We'll trust the controller to just update it, or add simple endpoint for each:
router.patch('/admin/:id/read', protect, notificationsController.markAsRead);
router.patch('/customer/:id/read', protectCustomer, notificationsController.markAsRead);

export default router;
