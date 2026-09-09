<?php

require_once __DIR__ . '/../src/bootstrap.php';

use App\Support\Http;

Http::applyCors();

// Path relative to this script's directory, e.g. "/inventory-api/public/api/units?x=1"
// with a script directory of "/inventory-api/public" becomes "/api/units".
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = '/' . trim(substr($requestPath, strlen($scriptDir)), '/');

/** @var \App\Support\Router $router */
$router = require __DIR__ . '/../src/routes.php';
$router->dispatch($_SERVER['REQUEST_METHOD'], $path);
