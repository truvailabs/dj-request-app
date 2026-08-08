import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePromise } from "../lib/stripe";
import { T } from "../lib/theme";

type Props = {
  clientSecret: string;
  amountLabel: string;
  onSuccess: () => void;
  onCancel: () => void;
};

function InnerForm({ amountLabel, onSuccess, onCancel }: Omit<Props, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed — try another card.");
      setSubmitting(false);
      return;
    }
    // Manual capture: a healthy hold lands in requires_capture, not succeeded.
    if (paymentIntent?.status === "requires_capture" || paymentIntent?.status === "succeeded") {
      onSuccess();
    } else {
      setError("Could not place the hold — try again.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <PaymentElement />
      {error && (
        <p style={{ color: T.hot, fontSize: 12, marginTop: 10, marginBottom: 0 }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${T.line}`,
            background: "transparent",
            color: T.muted,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={!stripe || submitting}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: T.grad,
            color: "#1A0A12",
            fontWeight: 700,
            fontSize: 14,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Placing hold…" : `Hold ${amountLabel} — not charged yet`}
        </button>
      </div>
    </div>
  );
}

export default function PaidCheckout({ clientSecret, amountLabel, onSuccess, onCancel }: Props) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: T.hot,
        colorBackground: T.room,
        colorText: T.ink,
        colorDanger: T.hot,
        borderRadius: "10px",
      },
    },
  };

  return (
    <Elements stripe={getStripePromise()} options={options}>
      <InnerForm amountLabel={amountLabel} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
