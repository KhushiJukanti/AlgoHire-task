import { Download } from 'lucide-react';
import type { MockWhatsAppMessage } from '@/src/types/certiflow';
import { Button } from '@/src/components/ui/button';

export function MockMessagePreview({ message, revoked = false }: {
  message: MockWhatsAppMessage;
  revoked?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
        <div>
          <p className="text-muted-foreground">Recipient</p>
          <p className="mt-1 break-words font-mono">{message.to || message.phone || 'Unavailable'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Provider status</p>
          <p className="mt-1 capitalize">{message.status || 'Accepted'}</p>
        </div>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-white p-4">
        <p className="font-semibold text-foreground">CertiFlow · Pragati Skills Mission</p>
        <p className="font-medium text-foreground">Your certificate is ready!</p>
        <p className="leading-relaxed text-muted-foreground">
          Congratulations on completing your training. Your certificate has been issued by
          Pragati Skills Mission. Use the button below to download your certificate.
        </p>
        {revoked ? (
          <p className="text-sm text-destructive">This certificate has been revoked and cannot be downloaded.</p>
        ) : message.downloadUrl ? (
          <Button asChild className="w-full sm:w-auto">
            <a href={message.downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Download Certificate
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">The download is not available yet.</p>
        )}
        <p className="text-xs text-muted-foreground">
          The download link is valid for seven days from creation. Contact your training centre if it expires.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Demo preview only. No real WhatsApp message was sent.</p>
    </div>
  );
}
