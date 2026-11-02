"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Link, useRouter } from "@/i18n/navigation";
import { loadCart, type CartView } from "@/actions/store/cart";
import { startCheckout, type SavedAddress } from "@/actions/store/checkout";
import { getLocalCart } from "@/lib/cart/local-cart";
import { cartTotals, type PaymentMethod } from "@/lib/domain/own-pricing";
import { formatMoney } from "@/lib/domain/money";
import { lookupCep } from "@/lib/cep";
import { markCheckoutStarted, trackAdEvent } from "./marketing-tracker";
import { inputClass } from "./auth-form";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, { locale: "pt-BR" }) : null;

type Address = Omit<SavedAddress, "id">;
const EMPTY: Address = { recipientName: "", cpf: "", phone: "", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };
export const BOLETO_SESSION_KEY = (n: number) => `nx_order_${n}_pay`;

/** `seller`: identity line from settings (Decreto 7.962/2013), or null while the admin has not filled it in. */
export function CheckoutForm({ saved, payments, seller = null }: { saved: SavedAddress[]; payments: { card: boolean; boleto: boolean; pix: boolean }; seller?: string | null }) {
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const router = useRouter();
  const [cart, setCart] = useState<CartView | null>(null);
  const [addressId, setAddressId] = useState<string>(saved[0]?.id ?? "new");
  const [addr, setAddr] = useState<Address>(EMPTY);
  const [saveAddress, setSaveAddress] = useState(saved.length === 0);
  const [method, setMethod] = useState<PaymentMethod>(payments.card ? "card" : payments.boleto ? "boleto" : "pix");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cepState, setCepState] = useState<"idle" | "loading" | "notfound">("idle");
  const [card, setCard] = useState<{ clientSecret: string; orderNumber: number } | null>(null);

  useEffect(() => {
    loadCart(getLocalCart()).then(setCart, () => setCart({ lines: [], subtotalMinor: 0, totalMinor: 0, checkoutable: false }));
  }, []);

  const totals = useMemo(() => cartTotals(cart?.lines.filter((l) => !l.problem) ?? [], method), [cart, method]);
  const money = (m: number) => formatMoney(m, "BRL", "pt-BR");
  const deliveryDays = (cart?.lines ?? []).map((l) => l.deliveryMaxDays).filter((d): d is number => typeof d === "number" && d > 0);
  const maxDeliveryDays = deliveryDays.length ? Math.max(...deliveryDays) : null;
  const address: Address = addressId === "new" ? addr : (saved.find((s) => s.id === addressId) ?? EMPTY);

  async function onCepBlur() {
    const digits = addr.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepState("loading");
    const r = await lookupCep(digits);
    if (!r) return setCepState("notfound");
    setCepState("idle");
    setAddr((a) => ({ ...a, street: r.street || a.street, district: r.district || a.district, city: r.city || a.city, state: r.state || a.state }));
  }

  const [chargedTotal, setChargedTotal] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart?.checkoutable || pending) return;
    setPending(true);
    setErrors({});
    setMessage(null);
    trackAdEvent("InitiateCheckout", { valueMinor: totals.totalMinor, currency: "BRL", contentIds: cart.lines.map((l) => l.productId) });
    const r = await startCheckout({ items: getLocalCart(), method, saveAddress: addressId === "new" && saveAddress, address, expectedTotalMinor: totals.totalMinor });
    setPending(false);
    if (!r.ok) {
      setMessage(r.error);
      setErrors(r.fieldErrors ?? {});
      if (r.priceChanged) loadCart(getLocalCart()).then(setCart, () => undefined);
      return;
    }
    setChargedTotal(r.totalMinor);
    markCheckoutStarted(r.orderNumber);
    if (r.kind === "card") return setCard({ clientSecret: r.clientSecret, orderNumber: r.orderNumber });
    try {
      sessionStorage.setItem(BOLETO_SESSION_KEY(r.orderNumber), JSON.stringify(r.kind === "boleto" ? { boleto: r.boleto } : { pix: r.pix }));
    } catch {
      /* the success page reads the boleto from the order instead */
    }
    router.push({ pathname: "/checkout/concluido", query: { pedido: String(r.orderNumber) } });
  }

  if (!cart) return <p className="py-10 text-sm text-mute">{tc("loading")}</p>;
  if (!cart.lines.length || !cart.checkoutable) {
    return (
      <div className="rounded-md border border-line px-6 py-14 text-center">
        <p className="font-semibold">{cart.lines.length ? tc("hidden") : tc("emptyTitle")}</p>
        <Link href={cart.lines.length ? "/carrinho" : "/produtos"} className="mt-6 inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white hover:bg-ink">
          {cart.lines.length ? t("reviewCart") : tc("explore")}
        </Link>
      </div>
    );
  }

  const field = (k: keyof Address, label: string, opts: { half?: boolean; inputMode?: "numeric" | "tel" | "text"; autoComplete?: string; onBlur?: () => void } = {}) => {
    const err = errors[`address.${k}`]?.[0];
    return (
      <div className={opts.half ? "" : "sm:col-span-2"}>
        <label htmlFor={`co-${k}`} className="mb-1.5 block text-sm font-medium">{label}</label>
        <input
          id={`co-${k}`}
          className={inputClass}
          value={addr[k]}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete}
          aria-invalid={!!err}
          onBlur={opts.onBlur}
          onChange={(e) => setAddr({ ...addr, [k]: e.target.value })}
          disabled={!!card}
        />
        {err && <p role="alert" className="mt-1 text-sm font-medium">⚠ {err}</p>}
      </div>
    );
  };

  const option = (m: PaymentMethod, label: string, note: string, enabled: boolean) => (
    <label className={`flex cursor-pointer gap-3 rounded-md border p-4 ${method === m ? "border-2 border-black" : "border-line"} ${enabled ? "" : "cursor-not-allowed opacity-50"}`}>
      <input type="radio" name="method" value={m} checked={method === m} disabled={!enabled || !!card} onChange={() => setMethod(m)} className="mt-1 accent-black" />
      <span>
        <span className="block text-sm font-medium">{enabled || m !== "pix" ? label : t("pixSoon")}</span>
        {enabled && <span className="block text-xs text-mute">{note}</span>}
      </span>
    </label>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <form onSubmit={submit} className="space-y-10" noValidate>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("addressTitle")}</h2>
          {saved.length > 0 && (
            <div>
              <label htmlFor="co-saved" className="mb-1.5 block text-sm font-medium">{t("savedAddress")}</label>
              <select id="co-saved" className={inputClass} value={addressId} onChange={(e) => setAddressId(e.target.value)} disabled={!!card}>
                {saved.map((s) => (
                  <option key={s.id} value={s.id}>{`${s.recipientName} — ${s.street}, ${s.number} · ${s.city}/${s.state}`}</option>
                ))}
                <option value="new">{t("newAddress")}</option>
              </select>
            </div>
          )}
          {addressId === "new" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("recipientName", t("recipientName"), { autoComplete: "name" })}
              {field("cpf", t("cpf"), { half: true, inputMode: "numeric" })}
              {field("phone", t("phone"), { half: true, inputMode: "tel", autoComplete: "tel" })}
              {field("cep", t("cep"), { half: true, inputMode: "numeric", autoComplete: "postal-code", onBlur: onCepBlur })}
              <div className="flex items-end text-xs text-mute sm:pb-3">{cepState === "loading" ? t("cepLoading") : cepState === "notfound" ? t("cepNotFound") : null}</div>
              {field("street", t("street"), { autoComplete: "address-line1" })}
              {field("number", t("number"), { half: true })}
              {field("complement", t("complement"), { half: true, autoComplete: "address-line2" })}
              {field("district", t("district"), { half: true })}
              {field("city", t("city"), { half: true, autoComplete: "address-level2" })}
              {field("state", t("state"), { half: true, autoComplete: "address-level1" })}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-black" disabled={!!card} />
                {t("saveAddress")}
              </label>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("paymentTitle")}</h2>
          {payments.card && option("card", t("card"), t("cardNote"), true)}
          {payments.boleto && option("boleto", t("boleto"), t("boletoNote"), true)}
          {option("pix", t("pix"), t("pixNote"), payments.pix)}
        </section>

        {message && <p role="alert" className="rounded-md border border-black px-4 py-3 text-sm font-medium">{message}</p>}

        <p className="text-xs leading-relaxed text-mute" data-testid="checkout-legal">
          {t.rich("legalNotice", {
            terms: (c) => <Link href="/termos" target="_blank" className="text-black underline underline-offset-2">{c}</Link>,
            privacy: (c) => <Link href="/privacidade" target="_blank" className="text-black underline underline-offset-2">{c}</Link>,
            returns: (c) => <Link href="/trocas-e-devolucoes" target="_blank" className="text-black underline underline-offset-2">{c}</Link>,
          })}
        </p>

        {!card && (
          <button type="submit" disabled={pending} className="h-12 w-full cursor-pointer rounded-md bg-black text-sm font-semibold uppercase tracking-wide text-white hover:bg-ink disabled:opacity-50">
            {pending ? t("processing") : method === "card" ? t("continue") : method === "boleto" ? t("generateBoleto", { total: money(totals.totalMinor) }) : t("generatePix", { total: money(totals.totalMinor) })}
          </button>
        )}
      </form>

      <aside className="h-fit space-y-4">
        <div className="space-y-3 rounded-md border border-line p-5">
          <h2 className="font-semibold">{t("summary")}</h2>
          <ul className="space-y-2 text-sm">
            {cart.lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3">
                <span>{l.quantity}× {l.name}</span>
                <span className="tabular">{money(l.lineTotalMinor)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line pt-3 text-sm"><span>{tc("shipping")}</span><span>{tc("free")}</span></div>
          {totals.discountMinor > 0 && <div className="flex justify-between text-sm"><span>{t("pixDiscount")}</span><span className="tabular">−{money(totals.discountMinor)}</span></div>}
          <div className="flex justify-between text-base font-semibold"><span>{tc("total")}</span><span className="tabular" data-testid="checkout-total">{money(totals.totalMinor)}</span></div>
          {maxDeliveryDays != null && <p className="text-xs text-mute">{t("deliveryEstimate", { days: maxDeliveryDays })}</p>}
          {seller && <p className="border-t border-line pt-3 text-xs text-mute" data-testid="checkout-seller">{t("soldBy", { seller })}</p>}
        </div>
        {card && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret: card.clientSecret, appearance: { theme: "flat", variables: { colorPrimary: "#000000", borderRadius: "6px", fontFamily: "system-ui, sans-serif" } } }}>
            <CardPayment orderNumber={card.orderNumber} totalLabel={t("pay", { total: money(chargedTotal ?? totals.totalMinor) })} />
          </Elements>
        )}
        <p className="text-center text-xs text-mute">{t("secure")}</p>
      </aside>
    </div>
  );
}

function CardPayment({ orderNumber, totalLabel }: { orderNumber: number; totalLabel: string }) {
  const t = useTranslations("checkout");
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const returnUrl = `${window.location.origin}/pt-br/checkout/concluido?pedido=${orderNumber}`;
    const { error: err } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    setPending(false);
    if (err) return setError(err.type === "card_error" || err.type === "validation_error" ? (err.message ?? t("cardError")) : t("cardError"));
    router.push({ pathname: "/checkout/concluido", query: { pedido: String(orderNumber) } });
  }

  return (
    <div className="space-y-4 rounded-md border border-line p-5" data-testid="card-payment">
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      {error && <p role="alert" className="text-sm font-medium">⚠ {error}</p>}
      <button type="button" onClick={pay} disabled={!stripe || pending} className="h-12 w-full cursor-pointer rounded-md bg-black text-sm font-semibold uppercase tracking-wide text-white hover:bg-ink disabled:opacity-50">
        {pending ? t("processing") : totalLabel}
      </button>
    </div>
  );
}
