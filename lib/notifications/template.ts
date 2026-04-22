import type { NotificationRecipient } from "@/lib/notifications/types";

const PLACEHOLDER_PATTERNS = {
  name: [/<name>/gi, /{{\s*name\s*}}/gi],
  first_name: [
    /<first name>/gi,
    /<first_name>/gi,
    /{{\s*first name\s*}}/gi,
    /{{\s*first_name\s*}}/gi
  ],
  email: [/<email>/gi, /{{\s*email\s*}}/gi],
  phone: [/<phone>/gi, /<phone number>/gi, /{{\s*phone\s*}}/gi, /{{\s*phone number\s*}}/gi],
  suggested_product: [
    /<suggested product>/gi,
    /<suggested_product>/gi,
    /{{\s*suggested product\s*}}/gi,
    /{{\s*suggested_product\s*}}/gi
  ],
  suggested_products: [
    /<suggested products>/gi,
    /<suggested_products>/gi,
    /{{\s*suggested products\s*}}/gi,
    /{{\s*suggested_products\s*}}/gi
  ]
} as const;

export const NOTIFICATION_LABELS = [
  "<name>",
  "<first name>",
  "<email>",
  "<phone>",
  "<suggested product>",
  "<suggested products>"
] as const;

export function buildRecipientTemplateContext(recipient: NotificationRecipient) {
  const name = recipient.name.trim() || "there";

  return {
    name,
    first_name: recipient.firstName.trim() || name.split(/\s+/)[0] || "there",
    email: recipient.email?.trim() || "",
    phone: recipient.phone?.trim() || "",
    suggested_product: recipient.suggestedProduct?.trim() || "recommended skincare",
    suggested_products:
      recipient.suggestedProducts.length > 0
        ? recipient.suggestedProducts.join(", ")
        : recipient.suggestedProduct?.trim() || "recommended skincare"
  };
}

export function personalizeNotificationTemplate(
  template: string,
  recipient: NotificationRecipient
) {
  let result = String(template || "");
  const context = buildRecipientTemplateContext(recipient);

  for (const [key, patterns] of Object.entries(PLACEHOLDER_PATTERNS)) {
    const value = context[key as keyof typeof context] || "";

    for (const pattern of patterns) {
      result = result.replace(pattern, value);
    }
  }

  return result;
}
