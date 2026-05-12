import { Request, Response } from 'express';
import { otpService } from '../services/otp.service';

export const otpController = {
  async request(req: Request, res: Response) {
    try {
      const { contact, method, companyId } = req.body;
      console.log('OTP REQUEST RECEIVED:', String(contact || '').trim().toLowerCase());
      const result = await otpService.requestOtp({ contact, method, companyId });
      res.json(result);
    } catch (e: any) {
      const status = e?.statusCode === 429 ? 429 : e?.statusCode === 400 ? 400 : 500;
      res.status(status).json({ success: false, message: e.message, code: 'OTP_REQUEST_FAILED' });
    }
  },

  async verify(req: Request, res: Response) {
    try {
      const { challengeId, code } = req.body;
      const result = await otpService.verifyOtp({ challengeId, code });
      res.json(result);
    } catch (e: any) {
      const status = e?.statusCode === 400 ? 400 : 500;
      res.status(status).json({ success: false, message: e.message, code: 'OTP_VERIFY_FAILED' });
    }
  },
};

