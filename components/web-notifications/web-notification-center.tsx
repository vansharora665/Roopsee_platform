"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  personalizeWebNotificationTemplate,
  WEB_NOTIFICATION_LABELS
} from "@/lib/web-notifications/template";
import type { WebNotificationRecipient, WebPushCampaignRecord } from "@/lib/web-notifications/types";
import { formatDate } from "@/lib/utils";

function campaignStatusClasses(status: WebPushCampaignRecord["status"]) {
  switch (status) {
    case "scheduled":
      return "bg-amber-100 text-amber-900";
    case "processing":
      return "bg-sky-100 text-sky-900";
    case "sent":
      return "bg-emerald-100 text-emerald-900";
    case "failed":
      return "bg-rose-100 text-rose-900";
    case "cancelled":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function audienceCount(campaign: WebPushCampaignRecord) {
  return campaign.audience.user_ids.length + campaign.audience.emails.length;
}

type WebNotificationCenterProps = {
  recipients: WebNotificationRecipient[];
  campaigns: WebPushCampaignRecord[];
};

export function WebNotificationCenter({
  recipients,
  campaigns
}: WebNotificationCenterProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("Roopsee");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/home_2");
  const [scheduleAt, setScheduleAt] = useState("");
  const [showOnlyReady, setShowOnlyReady] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<"title" | "body">("body");
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const filteredRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return recipients.filter((recipient) => {
      if (showOnlyReady && (!recipient.sendable || !recipient.hasWebSubscription)) {
        return false;
      }

      if (!query) return true;

      return [
        recipient.name,
        recipient.email || "",
        recipient.phone || "",
        recipient.suggestedProduct || "",
        recipient.suggestedProducts.join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [recipients, search, showOnlyReady]);

  const selectedRecipients = useMemo(() => {
    const selectedSet = new Set(selectedKeys);
    return recipients.filter((recipient) => selectedSet.has(recipient.key));
  }, [recipients, selectedKeys]);

  const previewRecipients = selectedRecipients.slice(0, 3);

  function toggleSelection(key: string) {
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function setAllVisibleSelected() {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const recipient of filteredRecipients) {
        if (recipient.sendable) {
          next.add(recipient.key);
        }
      }
      return Array.from(next);
    });
  }

  function clearSelection() {
    setSelectedKeys([]);
  }

  function insertLabel(label: string) {
    const isTitle = activeField === "title";
    const ref = isTitle ? titleRef.current : bodyRef.current;
    const value = isTitle ? title : body;
    const setter = isTitle ? setTitle : setBody;

    if (!ref) {
      setter(`${value}${value.endsWith(" ") || value.length === 0 ? "" : " "}${label}`);
      return;
    }

    const start = ref.selectionStart ?? value.length;
    const end = ref.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${label}${value.slice(end)}`;
    setter(nextValue);

    requestAnimationFrame(() => {
      ref.focus();
      const caret = start + label.length;
      ref.setSelectionRange(caret, caret);
    });
  }

  async function queueCampaign(sendAt: string | null) {
    if (!body.trim()) {
      setFeedback("Write the message before sending.");
      return;
    }

    if (selectedRecipients.length === 0) {
      setFeedback("Select at least one user first.");
      return;
    }

    startSubmitTransition(async () => {
      setFeedback(null);

      const response = await fetch("/api/web-notifications/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recipientKeys: selectedRecipients.map((recipient) => recipient.key),
          title,
          body,
          url,
          sendAt: sendAt ? new Date(sendAt).toISOString() : null
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback(payload?.error || "Could not queue the browser notification.");
        return;
      }

      setFeedback(
        sendAt
          ? "Scheduled. The browser-notification campaign is now queued on the shared worker."
          : payload?.results?.sent_count > 0
            ? `Sent now to ${payload.results.sent_count} browser${payload.results.sent_count === 1 ? "" : "s"}.`
            : payload?.results?.skipped_count > 0
              ? "No active browser subscription was found for the selected users."
              : "The browser notification could not be delivered."
      );
      if (!sendAt) {
        setScheduleAt("");
      }
      router.refresh();
    });
  }

  async function cancelCampaign(id: string) {
    startCancelTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/web-notifications/campaigns/${id}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback(payload?.error || "Could not cancel the campaign.");
        return;
      }

      setFeedback("Campaign cancelled.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-blue">
              Web notification center
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Send browser notifications instantly or queue them for later
            </h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Pick one or many customers, write one message, and personalize it with labels like
              name or suggested product. Send now queues immediately on the live web worker, and
              scheduled browser sends stay editable here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button variant="secondary">Back to funnel</Button>
            </Link>
            <Link href="/notifications">
              <Button variant="secondary">App notifications</Button>
            </Link>
            <Link href="/reports">
              <Button variant="secondary">Reports</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ready with browsers
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {recipients.filter((recipient) => recipient.hasWebSubscription).length}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Selected now
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{selectedRecipients.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Scheduled and active
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {campaigns.filter((campaign) => campaign.status === "scheduled").length}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">Audience</h2>
            <p className="text-sm text-slate-500">
              Search customers, pick one or many, and keep the focus on users whose browser has
              already granted and registered web notifications.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone, or suggested product"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                checked={showOnlyReady}
                className="h-4 w-4 rounded border-slate-300"
                onChange={(event) => setShowOnlyReady(event.target.checked)}
                type="checkbox"
              />
              Show only users ready for browser notifications
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={setAllVisibleSelected} variant="secondary">
                Select visible
              </Button>
              <Button onClick={clearSelection} variant="ghost">
                Clear
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Pick</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Suggested product</th>
                  <th className="px-4 py-3 font-semibold">Browser</th>
                  <th className="px-4 py-3 font-semibold">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecipients.map((recipient) => {
                  const checked = selectedKeys.includes(recipient.key);

                  return (
                    <tr key={recipient.key}>
                      <td className="px-4 py-3 align-top">
                        <input
                          checked={checked}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          disabled={!recipient.sendable}
                          onChange={() => toggleSelection(recipient.key)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-900">{recipient.name}</div>
                        <div className="text-xs text-slate-500">
                          {[recipient.email, recipient.phone].filter(Boolean).join(" · ") || "No contact"}
                        </div>
                        {!recipient.sendable ? (
                          <div className="mt-1 text-xs text-rose-600">Missing email or app user match</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-600">
                        {recipient.suggestedProducts.length > 0
                          ? recipient.suggestedProducts.slice(0, 2).join(", ")
                          : "No suggested product yet"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            recipient.hasWebSubscription
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {recipient.hasWebSubscription
                            ? `${recipient.subscriptionCount} subscription${recipient.subscriptionCount === 1 ? "" : "s"}`
                            : "No browser subscription yet"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {formatDate(recipient.lastActivityAt, "dd MMM yyyy, p")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">Compose message</h2>
              <p className="text-sm text-slate-500">
                Labels are replaced per user when the push is delivered.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {WEB_NOTIFICATION_LABELS.map((label) => (
                <button
                  key={label}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={() => insertLabel(label)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
                <Input
                  ref={titleRef}
                  onFocus={() => setActiveField("title")}
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Message</label>
                <Textarea
                  ref={bodyRef}
                  onFocus={() => setActiveField("body")}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Hello <name>, do carry your <suggested product> while out, it's sunny."
                  value={body}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Open URL</label>
                <Input onChange={(event) => setUrl(event.target.value)} value={url} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Schedule for later</label>
                <Input
                  onChange={(event) => setScheduleAt(event.target.value)}
                  type="datetime-local"
                  value={scheduleAt}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isSubmitting || selectedRecipients.length === 0 || !body.trim()}
                onClick={() => queueCampaign(null)}
              >
                {isSubmitting ? "Queueing..." : "Send now"}
              </Button>
              <Button
                disabled={isSubmitting || selectedRecipients.length === 0 || !body.trim() || !scheduleAt}
                onClick={() => queueCampaign(scheduleAt)}
                variant="secondary"
              >
                {isSubmitting ? "Saving..." : "Schedule"}
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Send now still uses the live shared web worker, so delivery usually starts within
              about 30 seconds.
            </p>

            {feedback ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{feedback}</div>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Preview</h2>
              <p className="text-sm text-slate-500">
                Showing the first few selected users with the labels already filled in.
              </p>
            </div>

            {previewRecipients.length === 0 ? (
              <p className="text-sm text-slate-500">Pick users to preview the personalized message.</p>
            ) : (
              <div className="space-y-3">
                {previewRecipients.map((recipient) => (
                  <div key={recipient.key} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{recipient.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{recipient.email || "No email"}</p>
                    <p className="mt-3 text-sm font-medium text-slate-900">
                      {personalizeWebNotificationTemplate(title, recipient) || "Roopsee"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {personalizeWebNotificationTemplate(body, recipient) || "Message body will appear here."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Queued and sent campaigns</h2>
          <p className="text-sm text-slate-500">
            These campaigns are shared with the live web-notification worker, so what you see here
            is what the browser delivery worker sees too.
          </p>
        </div>

        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <p className="text-sm text-slate-500">No campaigns queued yet.</p>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${campaignStatusClasses(campaign.status)}`}>
                      {campaign.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      Audience {audienceCount(campaign)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {campaign.send_at
                        ? `Scheduled ${formatDate(campaign.send_at, "dd MMM yyyy, p")}`
                        : `Created ${formatDate(campaign.created_at, "dd MMM yyyy, p")}`}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900">{campaign.title_template}</p>
                  <p className="max-w-3xl text-sm text-slate-600">{campaign.body_template}</p>
                </div>
                {campaign.status === "scheduled" ? (
                  <Button
                    disabled={isCancelling}
                    onClick={() => cancelCampaign(campaign.id)}
                    variant="danger"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel"}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
