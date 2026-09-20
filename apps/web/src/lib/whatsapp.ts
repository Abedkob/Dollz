import { money, type CartItem } from './storefront';

// Digits only: wa.me rejects "+", spaces, and the Lebanese trunk "0".
export const ATELIER_WHATSAPP_NUMBER = '9613011679';
export const ATELIER_WHATSAPP_DISPLAY = '+961 3 011 679';

// Long prefilled texts make wa.me links unreliable; stay well under browser
// and WhatsApp URL limits.
const MAX_ENCODED_URL_LENGTH = 1800;
const MAX_FREE_TEXT_LENGTH = 300;

export function whatsappUrl(text?: string) {
  const base = `https://wa.me/${ATELIER_WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export interface WhatsappOrderInput {
  orderNumber: string;
  trackingUrl: string;
  contact: {
    fullName: string;
    email: string;
    phone: string;
    preferredContactMethod: 'EMAIL' | 'PHONE' | 'WHATSAPP';
  };
  delivery: {
    shippingMethod: 'DELIVERY' | 'PICKUP';
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    country: string;
  };
  pickupLabel?: string;
  pickupCity?: string;
  notes: string;
  items: CartItem[];
  total: number;
  currency: string;
}

function clip(value: string) {
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length > MAX_FREE_TEXT_LENGTH
    ? `${text.slice(0, MAX_FREE_TEXT_LENGTH - 1)}…`
    : text;
}

function selectionLine(selection: CartItem['selections'][number]) {
  const parts = [selection.valueLabel];
  if (selection.customValue) parts.push(clip(selection.customValue));
  if (selection.customColor) parts.push(selection.customColor);
  return `   - ${selection.optionName}: ${parts.filter(Boolean).join(' · ')}`;
}

function deliveryLine(input: WhatsappOrderInput) {
  const { delivery } = input;
  if (delivery.shippingMethod === 'PICKUP')
    return `Pickup: ${input.pickupLabel ?? 'Dollz atelier'}, ${input.pickupCity ?? 'Beirut'}`;
  const address = [
    delivery.addressLine1,
    delivery.addressLine2,
    delivery.city,
    delivery.region,
    delivery.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  return `Delivery: ${address}`;
}

function contactMethod(
  method: WhatsappOrderInput['contact']['preferredContactMethod'],
) {
  return method === 'WHATSAPP'
    ? 'WhatsApp'
    : method[0] + method.slice(1).toLowerCase();
}

function fullMessage(input: WhatsappOrderInput) {
  const { contact } = input;
  const lines = [
    'Hello Dollz! I just sent a request.',
    `Order: ${input.orderNumber}`,
    '',
    `Name: ${contact.fullName.trim()}`,
    contact.phone.trim() ? `Phone: ${contact.phone.trim()}` : '',
    `Email: ${contact.email.trim()}`,
    `Preferred contact: ${contactMethod(contact.preferredContactMethod)}`,
    deliveryLine(input),
    '',
  ];
  input.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.productName} (${item.variantName}) x${item.quantity} — ${money(item.estimatedUnitPriceMinor * item.quantity, item.currency)}`,
    );
    item.selections.forEach((selection) =>
      lines.push(selectionLine(selection)),
    );
    if (item.customerRequest)
      lines.push(`   - Request: ${clip(item.customerRequest)}`);
  });
  if (input.notes.trim()) lines.push('', `Notes: ${clip(input.notes)}`);
  lines.push(
    '',
    `Estimated total: ${money(input.total, input.currency)}`,
    `Track my order: ${input.trackingUrl}`,
  );
  return lines
    .filter((line, i) => line !== '' || lines[i - 1] !== '')
    .join('\n');
}

function shortMessage(input: WhatsappOrderInput) {
  return [
    'Hello Dollz! I just sent a request.',
    `Order: ${input.orderNumber}`,
    `Name: ${input.contact.fullName.trim()}`,
    ...input.items.map(
      (item, index) =>
        `${index + 1}. ${item.productName} (${item.variantName}) x${item.quantity}`,
    ),
    `Track my order: ${input.trackingUrl}`,
  ].join('\n');
}

/** Message text for the customer's "notify the atelier" WhatsApp handoff. */
export function buildOrderWhatsappMessage(input: WhatsappOrderInput) {
  const message = fullMessage(input);
  return whatsappUrl(message).length <= MAX_ENCODED_URL_LENGTH
    ? message
    : shortMessage(input);
}
