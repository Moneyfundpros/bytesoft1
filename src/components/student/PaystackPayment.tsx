import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { db, auth } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

// Ensure TypeScript knows about PaystackPop on window
declare global {
  interface Window { PaystackPop?: any; }
}

// Fallback public key only used if the server doesn't return a publicKey
const FALLBACK_PAYSTACK_PUBLIC_KEY = 'pk_test_15e0101ecbbc2f3dccc416a3c9ea702cf8ed6865';
const AMOUNT_NGN = 2000; // 2000 NGN

export default function PaystackPayment({ courseId }: { courseId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadPaystack = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined') return reject('no-window');
      if (window.PaystackPop) return resolve();
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paystack script'));
      document.body.appendChild(script);
    });
  }, []);

  const handlePay = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await loadPaystack();

      // Debug: log Paystack library and key visibility
      console.debug('PaystackPop available?', !!window.PaystackPop);
      console.debug('Using Paystack inline checkout (server-init)');

      if (!window.PaystackPop) {
        console.error('Paystack script not loaded');
        alert('Payment provider failed to load. Please try again later.');
        return;
      }

      let handler: any;

      try {
        // Initialize transaction server-side to get reliable reference + access_code
        const functionsBaseRaw = import.meta.env.VITE_FUNCTIONS_BASE_URL || '';
        // Quick check for the common placeholder left in .env.local
        if (functionsBaseRaw.includes('<') || functionsBaseRaw.includes('%3C')) {
          console.error('VITE_FUNCTIONS_BASE_URL looks like a placeholder. Update `.env.local` with your Firebase project id. Current value:', functionsBaseRaw);
        }
        const functionsBase = functionsBaseRaw;
        const initUrl = `${functionsBase}/createPaystackTransaction`;

        // get ID token to authenticate request to our Cloud Function
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          alert('You must be signed in to make payments.');
          navigate('/login');
          return;
        }

        const initResp = await fetch(initUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ amount: AMOUNT_NGN, email: user.email, courseId })
        });

        if (!initResp.ok) {
          // Try to get text body for clearer debugging
          let body: any = null;
          try { body = await initResp.json(); } catch (_) { body = await initResp.text().catch(() => null); }
          console.error('Failed to initialize transaction. status=', initResp.status, 'url=', initUrl, 'body=', body);
          alert('Failed to start payment. Check the browser console for details.');
          return;
        }

        const initData = await initResp.json();
        console.debug('Paystack initialize response from server:', initData);
        const authorization = initData.authorization;
        const publicKey = initData.publicKey || FALLBACK_PAYSTACK_PUBLIC_KEY;

        if (!authorization || !authorization.reference) {
          console.error('Invalid initialize response from server:', initData);
          alert('Payment initialization failed.');
          return;
        }

        handler = window.PaystackPop.setup({
          key: publicKey,
          email: user.email,
          amount: Math.round(AMOUNT_NGN * 100), // inline accepts kobo amount sometimes; still ok to pass
          currency: 'NGN',
          ref: authorization.reference,
          // Some Paystack flows include an access_code in the initialize response;
          // pass it through in case the inline widget expects it.
          access_code: authorization.access_code || undefined,
          onClose: function() {
            navigate('/student/payment-failed');
          },
          callback: async function(response: any) {
            // Server-side verify (calls verifyPaystackPayment function)
            try {
              const verifyUrl = `${functionsBase}/verifyPaystackPayment`;
              const verifyResp = await fetch(verifyUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ reference: response.reference, amount: AMOUNT_NGN, courseId })
              });

              if (!verifyResp.ok) {
                const err = await verifyResp.json().catch(() => ({}));
                console.error('Verification failed:', err);
                // still navigate to failure
                navigate('/student/payment-failed');
                return;
              }

              const verifyData = await verifyResp.json();
              if (verifyData && verifyData.verified) {
                navigate('/student/payment-success');
              } else {
                console.error('Payment not marked verified by server:', verifyData);
                navigate('/student/payment-failed');
              }
            } catch (e) {
              console.error('Error verifying payment with server:', e);
              navigate('/student/payment-failed');
            }
          }
        });
      } catch (setupErr) {
        console.error('Paystack setup error:', setupErr);
        // Show clearer advice to the developer/user
        alert('We could not start the transaction — check your Paystack public key and browser console for details.');
        return;
      }

      // Open the inline checkout
      try {
        handler.openIframe();
      } catch (openErr) {
        console.error('Failed to open Paystack iframe:', openErr);
        alert('Failed to open payment window. Please try again.');
        navigate('/student/payment-failed');
      }
    } catch (e) {
      console.error('Paystack integration error:', e);
      alert('Payment initialization failed. See console for details.');
      navigate('/student/payment-failed');
    }
  };

  return (
    <Button onClick={handlePay} className="gap-2">
      Pay Fees
    </Button>
  );
}
