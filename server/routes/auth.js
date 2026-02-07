import express from 'express';
import {
    login,
    refresh,
    logout,
    changePassword,
    requireAdmin,
    verifyTwoFactorLogin,
    resendTwoFactorLogin,
    getTwoFactorSettings,
    sendTwoFactorSetupCode,
    confirmTwoFactorSetup,
    disableTwoFactor
} from '../services/auth.js';

const router = express.Router();

router.post('/login', (req, res) => login(req, res));
router.post('/2fa/verify-login', (req, res) => verifyTwoFactorLogin(req, res));
router.post('/2fa/resend-login', (req, res) => resendTwoFactorLogin(req, res));
router.post('/refresh', (req, res) => refresh(req, res));
router.post('/logout', (req, res) => logout(req, res));
router.post('/change-password', requireAdmin, (req, res) => changePassword(req, res));
router.get('/2fa', requireAdmin, (req, res) => getTwoFactorSettings(req, res));
router.post('/2fa/send-setup', requireAdmin, (req, res) => sendTwoFactorSetupCode(req, res));
router.post('/2fa/confirm-setup', requireAdmin, (req, res) => confirmTwoFactorSetup(req, res));
router.post('/2fa/disable', requireAdmin, (req, res) => disableTwoFactor(req, res));

export default router;
