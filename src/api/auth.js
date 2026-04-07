/* eslint-disable no-undef */
import { Router } from 'express';

const router = Router();

// Mock user store
const users = [
  {
    id: '1',
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  },
  {
    id: 'demo',
    email: 'demo@example.com',
    password: 'demopassword',
    name: 'Demo User',
  },
];

const createToken = (user) => {
  // In production use jsonwebtoken
  return Buffer.from(
    JSON.stringify({ id: user.id, name: user.name, exp: Date.now() + 3600000 })
  ).toString('base64');
};

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = createToken(user);
  res.cookie('refreshToken', 'mock-refresh-token', { httpOnly: true });
  res.json({ token });
});

router.post('/demo-login', (req, res) => {
  const user = users.find((u) => u.id === 'demo');
  const token = createToken(user);
  res.cookie('refreshToken', 'mock-refresh-token-demo', { httpOnly: true });
  res.json({ token });
});

router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ message: 'User already exists' });
  }
  users.push({ id: String(Date.now()), email, password, name });
  res.status(201).json({ message: 'User registered successfully' });
});

router.post('/refresh', (req, res) => {
  // Mock refresh always succeeds for now
  res.json({ token: createToken(users[0]) });
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

export default router;
