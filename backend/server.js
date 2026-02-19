import '../instrument.js';

import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import Pyroscope from '@pyroscope/nodejs';
import compression from 'compression';
import * as Sentry from '@sentry/node';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  Pyroscope.init({
    serverAddress: process.env.PYROSCOPE_SERVER_ADDRESS || 'http://localhost:4040',
    appName: process.env.PYROSCOPE_APP_NAME || 'proshop-backend',
  });
  Pyroscope.start();
}
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

const port = process.env.PORT || 5000;

connectDB();

const app = express();

app.use(compression()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


//http cache for users, we use the default CDN of Railway and we don't need to implement by ourself
app.use('/api/products', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, s-maxage=3600'); 
  }
  next();
}, productRoutes);

app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/config/paypal', (req, res) =>
  res.send({ clientId: process.env.PAYPAL_CLIENT_ID })
);

app.get("/api/debug-sentry", function mainHandler(req, res) {
  const now = new Date().toISOString();
  throw new Error(`Sentry test error at ${now}`);
});

if (process.env.NODE_ENV === 'production') {
  const __dirname = path.resolve();
  app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
  app.use(express.static(path.join(__dirname, '/frontend/build')));

  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, 'frontend', 'build', 'index.html'))
  );
} else {
  const __dirname = path.resolve();
  app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
  app.get('/', (req, res) => {
    res.send('API is running....');
  });
}

Sentry.setupExpressErrorHandler(app);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () =>
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`)
);
