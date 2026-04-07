/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// c:\Users\zerod\Documents\trading-bot-ui\mock-backend\mock-backend\server.js
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = 'your_dev_secret_key';

// Middleware
let options = {};
try {
  if (process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH) {
    options.key = fs.readFileSync(process.env.TLS_KEY_PATH);
    options.cert = fs.readFileSync(process.env.TLS_CERT_PATH);
  }
} catch (e) {
  console.warn("TLS certificates not found or invalid. Falling back to HTTP for local development.");
}

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'], // Added 5174
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trading-bot/trade';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB.....'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- MODELS ---

const tradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  amount: { type: Number, required: true },
  price: Number,
  status: { type: String, default: 'OPEN' },
  stopLoss: Number,
  timestamp: { type: Date, default: Date.now },
  balanceAfter: Number, // Snapshot for history charts
});

// Transform _id to id for frontend compatibility
tradeSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  },
});

const Trade = mongoose.model('Trade', tradeSchema);

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  description: { type: String },
});

const Transaction = mongoose.model('Transaction', transactionSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: String,
  walletBalance: { type: Number, default: 50000 }, // Default paper balance
});

const User = mongoose.model('User', userSchema);

// Helper to create tokens
// Helper to create tokens
const createTokens = (user) => {
  const accessToken = jwt.sign({ email: user.email, id: user.id }, SECRET_KEY, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ email: user.email, id: user.id }, SECRET_KEY, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Find user in DB
  const user = await User.findOne({ email });

  // Simple password check (in production, use bcrypt.compare)
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const { accessToken, refreshToken } = createTokens(user);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ token: accessToken, user });
});

app.post('/api/auth/demo-login', (req, res) => {
  const user = { id: 999, email: 'demo@example.com', name: 'Demo User', walletBalance: 50000 };
  const { accessToken, refreshToken } = createTokens(user);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ token: accessToken, user });
});

app.post('/api/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, SECRET_KEY);
    const newTokens = createTokens(decoded);

    res.cookie('refreshToken', newTokens.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token: newTokens.accessToken });
  } catch (_err) {
    res.status(403).json({ message: 'Invalid refresh token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });

  try {
    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const newUser = new User({ email, name, password });
    await newUser.save();

    res.status(201).json({ message: 'User created', user: newUser });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Get current user info (for wallet balance updates)
app.get('/api/user/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

app.post('/api/user/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid deposit amount' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.walletBalance += Number(amount);
    await user.save();

    // Create a new transaction record
    const transaction = new Transaction({ userId: user._id, type: 'deposit', amount: Number(amount) });
    await transaction.save();



    res.json({ message: 'Deposit successful', newBalance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: 'Error processing deposit' });
  }
});

app.post('/api/user/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.walletBalance < amount) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    user.walletBalance -= Number(amount);
    await user.save();

     const transaction = new Transaction({ userId: user._id, type: 'withdrawal', amount: Number(amount) });
     await transaction.save();


    res.json({ message: 'Withdrawal successful', newBalance: user.walletBalance });    
  } catch (err) {
    res.status(500).json({ message: 'Error processing withdrawal' });
  }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// --- TRADE ROUTES ---

app.get('/api/trades', authenticateToken, async (req, res) => {
  // Return trades only for the authenticated user
  const trades = await Trade.find({ userId: req.user.id }).sort({ timestamp: -1 });
  res.json(trades);
});

app.post('/api/trades', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const price = req.body.price || Math.random() * 1000 + 30000;
    const amount = req.body.amount;
    const cost = price * amount;

    // Check for sufficient funds
    if (user.walletBalance < cost) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    // Deduct balance
    user.walletBalance -= cost;
    await user.save();

    // Add a mock price if one isn't provided, so the chart looks okay
    const tradeData = {
      ...req.body,
      userId: user._id,
      price: price, 
      status: 'OPEN',
      balanceAfter: user.walletBalance, // Snapshot for history chart
    };
    const newTrade = new Trade(tradeData);
    await newTrade.save();
    res.status(201).json({ trade: newTrade, newBalance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: 'Error saving trade', error: err.message });
  }
});

app.delete('/api/trades/:id', async (req, res) => {
  const { id } = req.params;
  await Trade.findByIdAndDelete(id);
  res.json({ message: 'Trade deleted', id });
});

// Start Server
const { WebSocketServer } = require('ws');
const isHttps = !!(options.key && options.cert);
const server = isHttps 
  ? require('https').createServer(options, app) 
  : require('http').createServer(app);

const wss = new WebSocketServer({ server });

server.listen(PORT, () => {
  console.log(`Mock Backend running on ${isHttps ? 'https' : 'http'}://localhost:${PORT}`);
});
