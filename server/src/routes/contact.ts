import type { Request, Response } from 'express';
import { Router } from 'express';
import { sendContactEmail } from '../services/email.js';
import { isValidEmail } from '../utils/emailValidation.js';

const router: Router = Router();

/* POST /contact — envoyer un message à l'équipe (sans compte requis) */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, subject, message } = req.body as {
      email?: string;
      subject?: string;
      message?: string;
    };
    if (!email || !isValidEmail(email.trim())) {
      res.status(400).json({ error: 'Adresse email invalide' });
      return;
    }
    if (!message || message.trim().length < 10) {
      res.status(400).json({ error: 'Message trop court' });
      return;
    }
    const text = `De : ${email.trim()}\nSujet : ${(subject || '').trim()}\n\n${message.trim().slice(0, 2000)}`;
    const sent = await sendContactEmail(email.trim(), (subject || '').trim().slice(0, 120), text);
    if (!sent) {
      res.status(503).json({ error: 'Le canal de contact n’est pas encore configuré' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: "Erreur lors de l'envoi du message" });
  }
});

export default router;
