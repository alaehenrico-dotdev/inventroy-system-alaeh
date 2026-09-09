<?php

use App\Controllers\AuditTrailController;
use App\Controllers\AuthController;
use App\Controllers\FulfillmentController;
use App\Controllers\InventoryController;
use App\Controllers\LogBooksController;
use App\Controllers\LogisticsController;
use App\Controllers\Ospr\BatchController;
use App\Controllers\Ospr\BoxesUsedController;
use App\Controllers\Ospr\CloseController;
use App\Controllers\Ospr\ItemController;
use App\Controllers\PackersController;
use App\Controllers\ProductsController;
use App\Controllers\RtsController;
use App\Controllers\TransferController;
use App\Controllers\UnitsController;
use App\Controllers\WithdrawalController;
use App\Support\Router;

$router = new Router();

$router->map('POST', '/api/login', AuthController::class, 'login');

$router->map('GET', '/api/products', ProductsController::class, 'index');
$router->map('POST', '/api/products', ProductsController::class, 'index');

$router->map('GET', '/api/packers', PackersController::class, 'index');
$router->map('POST', '/api/packers', PackersController::class, 'index');

$router->map('GET', '/api/units', UnitsController::class, 'index');

$router->map('GET', '/api/channel-inventory', InventoryController::class, 'index');
$router->map('PUT', '/api/channel-inventory', InventoryController::class, 'index');
$router->map('GET', '/api/stock-alerts', InventoryController::class, 'lowStock');

$router->map('GET', '/api/withdrawals', WithdrawalController::class, 'index');
$router->map('POST', '/api/withdrawals', WithdrawalController::class, 'index');

$router->map('GET', '/api/ospr/batches', BatchController::class, 'index');
$router->map('POST', '/api/ospr/batches', BatchController::class, 'index');

$router->map('GET', '/api/ospr/items', ItemController::class, 'index');
$router->map('POST', '/api/ospr/items', ItemController::class, 'index');
$router->map('DELETE', '/api/ospr/items', ItemController::class, 'index');

$router->map('POST', '/api/ospr/close', CloseController::class, 'close');

$router->map('GET', '/api/ospr/boxes-used', BoxesUsedController::class, 'index');
$router->map('POST', '/api/ospr/boxes-used', BoxesUsedController::class, 'index');

$router->map('GET', '/api/transfers', TransferController::class, 'index');
$router->map('POST', '/api/transfers', TransferController::class, 'index');
$router->map('PUT', '/api/transfers', TransferController::class, 'index');

$router->map('GET', '/api/rts-triage', RtsController::class, 'index');
$router->map('POST', '/api/rts-triage', RtsController::class, 'index');

$router->map('GET', '/api/logistics', LogisticsController::class, 'index');
$router->map('POST', '/api/logistics', LogisticsController::class, 'index');

$router->map('GET', '/api/fulfillment-daily', FulfillmentController::class, 'index');
$router->map('POST', '/api/fulfillment-daily', FulfillmentController::class, 'index');

$router->map('GET', '/api/log-books', LogBooksController::class, 'index');

$router->map('GET', '/api/audit-trail', AuditTrailController::class, 'index');

return $router;
