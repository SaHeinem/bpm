import { useMemo, useState } from "react"
import { Mail, MailCheck, RefreshCw } from "lucide-react"

import { useEmails } from "@/hooks/use-emails"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type EmailFilter = "all" | "initial_assignment" | "final_assignment" | "individual_update"

const EMAIL_TYPE_LABELS: Record<Exclude<EmailFilter, "all">, string> = {
  initial_assignment: "Initial Assignment",
  final_assignment: "Final Assignment",
  individual_update: "Individual Update",
}

const EMAIL_TYPE_BADGES: Record<Exclude<EmailFilter, "all">, string> = {
  initial_assignment: "bg-success/10 text-success",
  final_assignment: "bg-primary/10 text-primary",
  individual_update: "bg-secondary/30 text-secondary-foreground",
}

export function EmailLog() {
  const { emailLogs, isLoading, refetch } = useEmails()
  const [filter, setFilter] = useState<EmailFilter>("all")

  const filteredLogs = useMemo(() => {
    if (filter === "all") {
      return emailLogs
    }
    return emailLogs.filter((log) => log.email_type === filter)
  }, [emailLogs, filter])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Email Log</h2>
          <p className="text-muted-foreground">Review every email that has been sent from Blind Peering.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as EmailFilter)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by email type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All emails</SelectItem>
              <SelectItem value="initial_assignment">Initial assignments</SelectItem>
              <SelectItem value="final_assignment">Final assignments</SelectItem>
              <SelectItem value="individual_update">Individual updates</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="bg-transparent" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sent Emails</CardTitle>
          <CardDescription>Entries are shown in the order they were sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertTitle>No emails yet</AlertTitle>
              <AlertDescription>
                Emails sent from assignments and participant actions will be tracked automatically.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const sentAt = new Date(log.sent_at ?? log.created_at).toLocaleString()
                const badgeClass = EMAIL_TYPE_BADGES[log.email_type as Exclude<EmailFilter, "all">]
                const emailTypeLabel = EMAIL_TYPE_LABELS[log.email_type as Exclude<EmailFilter, "all">]
                const restaurantName = typeof log.metadata?.restaurantName === "string" ? log.metadata.restaurantName : null
                const captainName = typeof log.metadata?.captainName === "string" ? log.metadata.captainName : null
                const rawGuestCount = log.metadata?.guestCount
                const guestCount =
                  typeof rawGuestCount === "number"
                    ? rawGuestCount
                    : typeof rawGuestCount === "string" && rawGuestCount.trim().length > 0
                      ? Number.parseInt(rawGuestCount, 10)
                      : null

                return (
                  <div key={log.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-emerald-500/10">
                          <MailCheck className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{log.subject}</p>
                            {badgeClass && <Badge className={badgeClass}>{emailTypeLabel}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">Sent to {log.recipient_email}</p>
                          {restaurantName && (
                            <p className="text-xs text-muted-foreground">Restaurant: {restaurantName}</p>
                          )}
                          {captainName && (
                            <p className="text-xs text-muted-foreground">Captain: {captainName}</p>
                          )}
                          {guestCount !== null && (
                            <p className="text-xs text-muted-foreground">Guests in email: {guestCount}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{sentAt}</div>
                    </div>
                    <div className="mt-3">
                      <pre className="max-h-48 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                        {log.body_text}
                      </pre>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
