import express from 'express';
import { login, refresh, logout } from '../services/auth.js';

const router = express.Router();

router.post('/login', (req, res) => login(req, res));
router.post('/refresh', (req, res) => refresh(req, res));
router.post('/logout', (req, res) => logout(req, res));

export default router;
