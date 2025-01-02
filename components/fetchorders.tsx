'use client';

import { useEffect, useState } from 'react';

interface RelevantEmail {
  subject: string;
  messageId: string;
}

interface OrdersResponse {
  success: boolean;
  message: string;
  data?: {
    relevantEmails: RelevantEmail[];
    syncTime: string;
  };
  needsSync?: boolean;
}

export default function FetchOrders() {
  const [isLoading, setIsLoading] = useState(true);
  const [emails, setEmails] = useState<RelevantEmail[]>([]);
  const [message, setMessage] = useState<string>("Checking for new emails...");
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/orders', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch emails');
        }

        const data: OrdersResponse = await response.json();
        
        if (data.success) {
          if (data.needsSync === false) {
            setMessage(data.message);
          } else if (data.data) {
            setEmails(data.data.relevantEmails);
            setLastSync(data.data.syncTime);
            setMessage(`Last synced: ${new Date(data.data.syncTime).toLocaleString()}`);
          }
        } else {
          throw new Error(data.message || 'Failed to process emails');
        }
      } catch (error) {
        console.error('Error fetching emails:', error);
        setMessage('Failed to fetch emails. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const containerClasses = "min-h-[400px] border rounded-lg p-4 bg-muted/50";

  if (isLoading) {
    return (
      <div className={containerClasses}>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className={containerClasses}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">No order-related emails found.</p>
          {lastSync && (
            <p className="text-xs text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">Found: {emails.length}</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {emails.map((email) => (
            <div key={email.messageId} className="flex items-center justify-between py-2 px-3 bg-background rounded border">
              <span className="text-sm truncate flex-1">{email.subject}</span>
              <span className="text-xs text-muted-foreground ml-2 font-mono">{email.messageId.slice(0, 8)}...</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

