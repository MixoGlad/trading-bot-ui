import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { WebSocketServer, WebSocket } from 'ws';
import 'dotenv/config'; // Loads variables from .env

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

// Redis Client Setup
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('error', (err) => console.error('Redis Client Error', err));

app.use(express.json());
app.use(cookieParser());

// Define Trade Schema and Model for MongoDB Persistence
const tradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  amount: { type: Number, required: true },
  price: { type: Number, required: true },
  status: { type: String, default: 'OPEN' },
  timestamp: { type: Date, default: Date.now },
  balanceAfter: { type: Number }
});

// Middleware to validate that balanceAfter is never negative before saving
tradeSchema.pre('save', function(next) {
  if (this.balanceAfter < 0) {
    return next(new Error('Validation Error: balanceAfter cannot be negative.'));
  }
  next();
});

const Trade = mongoose.model('Trade', tradeSchema);

// Define User Schema to track wallet balance
const userSchema = new mongoose.Schema({
  username: { type: String, default: 'DemoUser' },
  walletBalance: { type: Number, default: 50000 },
  role: { type: String, default: 'user' }
});

// Middleware to validate that walletBalance is never negative before saving
userSchema.pre('save', function(next) {
  if (this.walletBalance < 0) {
    return next(new Error('Validation Error: walletBalance cannot be negative.'));
  }
  next();
});

const User = mongoose.model('User', userSchema);

// Define Error Log Schema for persistence
const errorLogSchema = new mongoose.Schema({
  userId: String,
  message: String,
  stack: String,
  componentStack: String,
  errorType: String,
  url: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});
const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);

// Health check endpoint for GKE Liveness/Readiness probes
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({ 
    status: isConnected ? 'healthy' : 'database disconnected' 
  });
});

// GKE Deployment Management Routes
app.post('/api/gke/deploy', async (req, res) => {
  try {
    const { clusterName } = req.body;
    console.log(`🚀 Initializing GKE Deployment for: ${clusterName}`);
    // Mock initialization delay
    res.status(202).json({ message: 'Deployment initialized', status: 'PROVISIONING' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gke/status', (req, res) => {
  // Mock a running cluster for the UI to transition to ACTIVE
  res.json({ status: 'RUNNING', statusMessage: 'Cluster is healthy' });
});

app.delete('/api/gke/cluster/:name', (req, res) => {
  try {
    res.status(200).json({ message: `Cluster ${req.params.name} deletion started` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Initialization function to connect to DB before starting the server
 */
async function bootstrap() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined in the environment.');
    }

    console.log('Connecting to Redis...');
    await redisClient.connect();

    console.log('Connecting to MongoDB...');
    // The await keyword blocks execution until the connection is successful
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connection established.');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Trading Bot Backend running on port ${PORT}`);
    });

    // Initialize WebSocket server attached to the HTTP server on the /stream path
    const wss = new WebSocketServer({ server, path: '/stream' });

    wss.on('connection', (ws) => {
      console.log('📈 Client connected to live price stream');

      ws.on('error', console.error);
      ws.on('close', () => console.log('📉 Client disconnected from stream'));
    });

    // Endpoint to fetch persisted trades from the database
    app.get('/api/trades', async (req, res) => {
      try {
        const trades = await Trade.find().sort({ timestamp: -1 }).limit(50);
        // Map _id to id for frontend compatibility
        res.json(trades.map((t) => ({ ...t.toObject(), id: t._id })));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Endpoint to clear all error logs (Admin only)
    app.delete('/api/logs/error', async (req, res) => {
      try {
        // In a production environment, you would validate the admin role via JWT/Middleware here
        await ErrorLog.deleteMany({});
        res.status(204).send();
      } catch (err) {
        res.status(500).json({ error: 'Failed to clear system logs' });
      }
    });

    // Endpoint to retrieve global error logs with optional userId filtering
    app.get('/api/logs/error', async (req, res) => {
      try {
        const { userId } = req.query;
        const query = userId ? { userId } : {};
        
        const logs = await ErrorLog.find(query).sort({ timestamp: -1 }).limit(100);
        res.json(logs);
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
      }
    });

    // Endpoint to receive and persist global error logs
    app.post('/api/logs/error', async (req, res) => {
      try {
        const log = new ErrorLog(req.body);
        await log.save();
        res.status(204).send(); // No content needed for log confirmation
      } catch (err) {
        console.error('Failed to save error log:', err.message);
        res.status(500).json({ error: 'Internal logging failure' });
      }
    });

    // Authentication Routes
    app.post('/api/auth/login', async (req, res) => {
      const { email } = req.body;
      
      // In a real app, verify credentials here.
      const accessToken = 'mock-access-token-' + Date.now();
      const refreshToken = 'mock-refresh-token-' + Date.now();

      // Store the session in Redis with a 30-day expiration
      await redisClient.set(`session:${refreshToken}`, 'active', { EX: 30 * 24 * 60 * 60 });

      // Set the refresh token in an HttpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax',
        path: '/', 
        maxAge: 30 * 24 * 60 * 60 * 1000 
      });

      res.json({ 
        token: accessToken, 
        user: { username: 'DemoUser', email: email || 'demo@example.com', role: 'admin' } 
      });
    });

    app.post('/api/auth/refresh', (req, res) => {
      const token = req.cookies.refreshToken;

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Refresh token missing' });
      }

      res.json({ token: 'new-mock-access-token-' + Date.now() });
    });

    app.post('/api/auth/logout', (req, res) => {
      // Clear the cookie by setting an expired date
      res.clearCookie('refreshToken', { path: '/' });
      res.json({ message: 'Logged out successfully' });
    });

    // Endpoint to get current user data (including balance)
    app.get('/api/user/me', async (req, res) => {
      try {
        let user = await User.findOne();
        if (!user) {
          user = await User.create({ username: 'DemoUser', walletBalance: 50000, role: 'admin' });
        }
        res.json(user);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Endpoint to receive new trades and broadcast them to all active subscribers
    app.post('/api/trades', async (req, res) => {
      const session = await mongoose.startSession();
      try {
        let responseTrade;

        // withTransaction automatically handles retries for TransientTransactionErrors
        // and UnknownTransactionCommitResults caused by network jitter or node elections.
        await session.withTransaction(async () => {
          const { symbol, amount, price, status } = req.body;
          const tradeStatus = status || 'BUY';

          // Retrieve the user within the transaction session
          let user = await User.findOne().session(session);
          if (!user) {
            // create() expects an array of documents when using a session
            [user] = await User.create([{ username: 'DemoUser', walletBalance: 50000 }], { session });
          }

          const cost = Number(amount) * Number(price);
          
          const newBalance = tradeStatus === 'BUY' 
            ? user.walletBalance - cost 
            : user.walletBalance + cost;

          if (tradeStatus === 'BUY' && newBalance < 0) {
            throw new Error('Validation Error: Insufficient funds in wallet');
          }

          // Update user balance in database
          user.walletBalance = newBalance;
          await user.save({ session });

          const newTrade = new Trade({
            symbol: symbol || 'BTCUSDT',
            amount: Number(amount) || 0,
            price: Number(price) || 0,
            status: tradeStatus,
            balanceAfter: newBalance,
          });

          const savedTrade = await newTrade.save({ session });
          responseTrade = { 
            ...savedTrade.toObject(), 
            id: savedTrade._id,
            newBalance 
          };
        });

        // Broadcast only after the transaction is successfully committed
        const broadcastMessage = JSON.stringify({
          type: 'tradeUpdate',
          payload: responseTrade,
        });

        // Iterate through all connected WebSocket clients and send the update
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastMessage);
          }
        });

        res.status(201).json(responseTrade);
      } catch (err) {
        console.error('Failed to persist trade:', err);

        // Handle custom middleware or schema validation errors with a 400 status
        if (err.name === 'ValidationError' || err.message.includes('Validation Error')) {
          return res.status(400).json({
            error: 'Transaction Denied',
            message: err.message
          });
        }

        res.status(500).json({ error: err.message });
      } finally {
        session.endSession();
      }
    });

    // Simulate periodic market data updates for the frontend Dashboard
    setInterval(() => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'WUSDT'];
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      
      const update = {
        type: 'priceUpdate',
        payload: {
          symbol: randomSymbol,
          price: 30000 + Math.random() * 5000
        }
      };

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(update));
        }
      });
    }, 2000);

  } catch (error) {
    console.error('CRITICAL: Server failed to start:', error.message);
    process.exit(1); // Exit with failure code for orchestrator (GKE) to handle
  }
}

bootstrap();