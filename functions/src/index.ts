import * as dotenv from 'dotenv';
import * as path from 'path';

// manually load .env from functions/ folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';
import axios from 'axios';
// axios removed (unused after removing Paystack integration)

admin.initializeApp();

// Prefer Firebase functions config (recommended for deployed env) and
// fall back to process.env (useful for local .env during development).
const cfg = functions.config ? functions.config() : {} as any;

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || cfg.livekit?.api_key || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || cfg.livekit?.api_secret || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL || cfg.livekit?.url || '';
// Paystack removed: do not load Paystack env variables

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  functions.logger.error('LiveKit credentials not configured. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL environment variables.');
}

const validateAuthToken = async (req: functions.https.Request): Promise<{ uid: string } | null> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return { uid: decodedToken.uid };
  } catch (error: any) {
    functions.logger.warn('Token verification failed:', error);
    return null;
  }
};

export const token = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      res.status(500).json({ error: 'LiveKit credentials not configured' });
      return;
    }

    const authResult = await validateAuthToken(req);
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized. Please provide a valid authentication token.' });
      return;
    }

    const { identity, roomName, role } = req.body;

    if (!identity || !roomName) {
      res.status(400).json({ error: 'Missing required fields: identity and roomName' });
      return;
    }

    if (typeof identity !== 'string' || typeof roomName !== 'string') {
      res.status(400).json({ error: 'Invalid field types. identity and roomName must be strings.' });
      return;
    }

    if (identity.length > 256 || roomName.length > 256) {
      res.status(400).json({ error: 'Fields too long. Maximum length is 256 characters.' });
      return;
    }

    const roleValue = role === 'viewer' || role === 'observer' ? 'viewer' : 'participant';

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: '2h',
      metadata: JSON.stringify({ userId: authResult.uid }),
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: roleValue !== 'viewer',
      canSubscribe: true,
      canPublishData: roleValue !== 'viewer',
    });

    const generatedToken = await at.toJwt();

    functions.logger.info(`Token generated for user ${authResult.uid} in room ${roomName}`);
    res.status(200).json({ token: generatedToken, url: LIVEKIT_URL });
  } catch (error: any) {
    functions.logger.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

export const createMeeting = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can create meetings' });
      return;
    }

    const { title, roomName, scheduledTime, participants } = req.body;

    if (!title || !roomName || !scheduledTime) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const meetingRef = await admin.firestore().collection('meetings').add({
      title,
      roomName,
      scheduledTime: admin.firestore.Timestamp.fromDate(new Date(scheduledTime)),
      teacherId: userId,
      participants: participants || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ id: meetingRef.id, message: 'Meeting created successfully' });
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

export const getMeetings = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userRole = userDoc.data()?.role;
    let meetingsQuery;

    if (userRole === 'coordinator' || userRole === 'admin') {
      meetingsQuery = admin.firestore().collection('meetings').orderBy('scheduledTime', 'desc');
    } else if (userRole === 'teacher') {
      meetingsQuery = admin.firestore().collection('meetings')
        .where('teacherId', '==', userId)
        .orderBy('scheduledTime', 'desc');
    } else {
      meetingsQuery = admin.firestore().collection('meetings')
        .where('participants', 'array-contains', userId)
        .orderBy('scheduledTime', 'desc');
    }

    const snapshot = await meetingsQuery.get();
    const meetings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ meetings });
  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// Paystack integration removed: provide stub endpoints that return 410 Gone
export const verifyPaystackPayment = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).send(''); return; }
  res.status(410).json({ error: 'Paystack integration has been removed from this project' });
});

export const createPaystackTransaction = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).send(''); return; }
  res.status(410).json({ error: 'Paystack integration has been removed from this project' });
});

// Callable function: generate exam questions using coordinator AI key stored at /settings/aiKey
export const generateExamQuestions = functions.https.onCall(async (data, context) => {
  // data: { courseId, schemeItems: string[], duration, numQuestions, difficulty }
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;
  const { courseId, schemeItems, duration, numQuestions, difficulty } = data;

  if (!courseId || !Array.isArray(schemeItems) || schemeItems.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing courseId or schemeItems');
  }

  // verify user is teacher of the course
  const courseDoc = await admin.firestore().collection('courses').doc(courseId).get();
  if (!courseDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Course not found');
  }
  const course = courseDoc.data();
  if (!course) {
    throw new functions.https.HttpsError('not-found', 'Course not found');
  }
  if (course.teacherId !== uid && !(await (async () => {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    return userDoc.exists && (userDoc.data()?.role === 'coordinator' || userDoc.data()?.role === 'admin');
  })())) {
    throw new functions.https.HttpsError('permission-denied', 'Only the assigned teacher, coordinator or admin may generate questions for this course');
  }

  // read coordinator AI key from /settings/aiKey
  const settingsDoc = await admin.firestore().collection('settings').doc('aiKey').get();
  const settings = settingsDoc.exists ? settingsDoc.data() : null;
  const provider = settings?.provider || null;
  const apiKey = settings?.key || null;

  // If no provider/key configured, generate placeholder questions locally (deterministic simple generator)
  if (!apiKey) {
    const generated = ([] as any[]).concat(...schemeItems.map((s: string, idx: number) => {
      const countPer = Math.max(1, Math.floor(numQuestions / schemeItems.length));
      const items: any[] = [];
      for (let i = 0; i < countPer; i++) {
        const qnum = idx * countPer + i + 1;
        items.push({
          question: `(${s}) Sample question ${qnum}: Explain the concept of ${s} and show an example.`,
          options: ['Answer A', 'Answer B', 'Answer C', 'Answer D'],
          correct: 'Answer A',
          schemeItem: s,
          points: 1
        });
      }
      return items;
    }));
    return { questions: generated.slice(0, numQuestions), source: 'local_stub' };
  }

  // Provider call (generic): provider and apiKey determine the endpoint
  // This example calls an OpenAI-like endpoint if provider === 'openai' (user can change as needed)
  try {
    if (provider === 'openai') {
      const prompt = `Create ${numQuestions} multiple-choice questions from these topics:\n${schemeItems.join('\n')}\nDifficulty: ${difficulty} \nInclude 4 options and indicate the correct option.`;
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'You are a helpful exam question generator.' }, { role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500
      }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      // naive parse of returned text into questions — recommend improving parsing on real provider
      const text = resp.data?.choices?.[0]?.message?.content || resp.data?.choices?.[0]?.text || '';
      // split by numbered lines as a heuristic
      const raw = text.split(/\n\d+\.\s+/).map(s => s.trim()).filter(Boolean);
      const questions = raw.slice(0, numQuestions).map(r => ({ question: r, options: [], correct: null }));
      return { questions, source: 'openai' };
    }

    // unsupported provider: return stub
    return { questions: [], source: 'unsupported_provider' };
  } catch (err: any) {
    functions.logger.error('AI generation failed:', err.message || err);
    throw new functions.https.HttpsError('internal', 'AI generation failed');
  }
});
