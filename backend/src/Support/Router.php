<?php

namespace App\Support;

class Router
{
    /** @var array<string, array{0: string, 1: string}> */
    private array $routes = [];

    /** @var array<string, true> registered paths, regardless of method - lets us tell 404 from 405 */
    private array $knownPaths = [];

    public function map(string $method, string $path, string $controllerClass, string $action): void
    {
        $path = rtrim($path, '/');
        $this->routes[$method . ' ' . $path] = [$controllerClass, $action];
        $this->knownPaths[$path] = true;
    }

    public function dispatch(string $method, string $path): void
    {
        $path = rtrim($path, '/');
        $key = $method . ' ' . $path;

        if (isset($this->routes[$key])) {
            [$controllerClass, $action] = $this->routes[$key];
            (new $controllerClass())->$action();
            return;
        }

        if (isset($this->knownPaths[$path])) {
            Http::sendError('Method not allowed', 405);
        }

        Http::sendError('Not found', 404);
    }
}
