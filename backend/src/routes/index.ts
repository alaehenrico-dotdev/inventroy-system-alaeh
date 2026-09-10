// Route table - 1:1 with the old routes.php.
import * as authController from '../controllers/authController.js';
import * as auditTrailController from '../controllers/auditTrailController.js';
import * as fulfillmentController from '../controllers/fulfillmentController.js';
import * as inventoryController from '../controllers/inventoryController.js';
import * as logBooksController from '../controllers/logBooksController.js';
import * as logisticsController from '../controllers/logisticsController.js';
import * as receiptController from '../controllers/logistics/receiptController.js';
import * as receiptItemController from '../controllers/logistics/receiptItemController.js';
import * as receiptCloseController from '../controllers/logistics/receiptCloseController.js';
import * as batchController from '../controllers/ospr/batchController.js';
import * as itemController from '../controllers/ospr/itemController.js';
import * as closeController from '../controllers/ospr/closeController.js';
import * as boxesUsedController from '../controllers/ospr/boxesUsedController.js';
import * as packersController from '../controllers/packersController.js';
import * as productsController from '../controllers/productsController.js';
import * as rtsController from '../controllers/rtsController.js';
import * as transferController from '../controllers/transferController.js';
import * as unitsController from '../controllers/unitsController.js';
import * as withdrawalController from '../controllers/withdrawalController.js';
import { ExactRouter } from './router.js';

export const router = new ExactRouter();

router.map('POST', '/api/login', authController.login);

router.map('GET', '/api/products', productsController.index);
router.map('POST', '/api/products', productsController.index);
router.map('GET', '/api/products/lookup', productsController.lookup);

router.map('GET', '/api/packers', packersController.index);
router.map('POST', '/api/packers', packersController.index);

router.map('GET', '/api/units', unitsController.index);

router.map('GET', '/api/channel-inventory', inventoryController.index);
router.map('PUT', '/api/channel-inventory', inventoryController.index);
router.map('GET', '/api/stock-alerts', inventoryController.lowStock);

router.map('GET', '/api/withdrawals', withdrawalController.index);
router.map('POST', '/api/withdrawals', withdrawalController.index);

router.map('GET', '/api/ospr/batches', batchController.index);
router.map('POST', '/api/ospr/batches', batchController.index);

router.map('GET', '/api/ospr/items', itemController.index);
router.map('POST', '/api/ospr/items', itemController.index);
router.map('DELETE', '/api/ospr/items', itemController.index);

router.map('POST', '/api/ospr/close', closeController.close);

router.map('GET', '/api/ospr/boxes-used', boxesUsedController.index);
router.map('POST', '/api/ospr/boxes-used', boxesUsedController.index);

router.map('GET', '/api/transfers', transferController.index);
router.map('POST', '/api/transfers', transferController.index);
router.map('PUT', '/api/transfers', transferController.index);

router.map('GET', '/api/rts-triage', rtsController.index);
router.map('POST', '/api/rts-triage', rtsController.index);

router.map('GET', '/api/logistics', logisticsController.index);
router.map('POST', '/api/logistics', logisticsController.index);

router.map('GET', '/api/logistics/receipts', receiptController.index);
router.map('POST', '/api/logistics/receipts', receiptController.index);

router.map('GET', '/api/logistics/receipts/items', receiptItemController.index);
router.map('POST', '/api/logistics/receipts/items', receiptItemController.index);
router.map('DELETE', '/api/logistics/receipts/items', receiptItemController.index);

router.map('POST', '/api/logistics/receipts/close', receiptCloseController.close);

router.map('GET', '/api/fulfillment-daily', fulfillmentController.index);
router.map('POST', '/api/fulfillment-daily', fulfillmentController.index);

router.map('GET', '/api/log-books', logBooksController.index);

router.map('GET', '/api/audit-trail', auditTrailController.index);
