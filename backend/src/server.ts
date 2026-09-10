// ============================================================
// Express entry point - mirrors backend/public/index.php +
// Support/Http::applyCors(). No subdirectory-stripping dance is
// needed here (that was only for XAMPP serving this out of
// /inventory-api/public/) - Express is its own front controller.
// ============================================================
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from './config/env.js';
import { router } from './routes/index.js';

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  }),
);

app.use(express.json());

// PHP's Http::jsonInput() silently treats an empty/invalid body as [] rather
// than erroring - replicate that instead of Express's default "crash with an
// HTML error page" behavior for malformed JSON.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    req.body = {};
    return next();
  }
  next(err);
});

app.use(router.middleware());

app.listen(env.PORT, () => {
  console.log(`Ala Eh! Inventory API listening on port ${env.PORT}`);
});
