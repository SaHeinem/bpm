import { useMemo, useState } from "react";
import {
  Search,
  Users,
  UtensilsCrossed,
  ArrowRightLeft,
  AlertTriangle,
  Download,
  X,
  Mail,
  MailCheck,
} from "lucide-react";

import { useAssignments } from "@/hooks/use-assignments";
import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useToast } from "@/hooks/use-toast";
import { useEventStatus } from "@/hooks/use-event-status";
import { useActivityLogger } from "@/hooks/use-activity-log";
import { useEmails } from "@/hooks/use-emails";
import {
  buildRestaurantRosters,
  generateAssignmentCsv,
  buildRosterPrintHtml,
} from "@/lib/assignment-utils";
import type { Participant } from "@/types/database";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const occupancyBadge = (ratio: number) => {
  if (ratio >= 1) return "bg-destructive text-destructive-foreground";
  if (ratio >= 0.8) return "bg-warning text-warning-foreground";
  return "bg-success text-success-foreground";
};

export function AssignmentsView() {
  const {
    assignments,
    isLoading: assignmentsLoading,
    assignMutation,
    unassignMutation,
  } = useAssignments();
  const { participants, isLoading: participantsLoading } = useParticipants();
  const { restaurants, isLoading: restaurantsLoading } = useRestaurants();
  const { toast } = useToast();
  const { eventStatus, setEventStatusMutation } = useEventStatus();
  const activityLogger = useActivityLogger();
  const { emailLogs, sendEmailMutation } = useEmails();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"people" | "restaurants">(
    "people"
  );
  const [pendingAdd, setPendingAdd] = useState<Record<string, string>>({});

  const participantById = useMemo(
      () =>
        new Map(participants.map((participant) => [participant.id, participant])),
    [participants]
  );

  const firstEmailByParticipant = useMemo(() => {
    const map = new Map<string, { sentAt: string; emailType: string }>();
    emailLogs.forEach((log) => {
      const sentAt = log.sent_at ?? log.created_at;
      if (!sentAt) return;
      const stored = map.get(log.participant_id);
      if (!stored || new Date(sentAt).getTime() < new Date(stored.sentAt).getTime()) {
        map.set(log.participant_id, {
          sentAt,
          emailType: log.email_type,
        });
      }
    });
    return map;
  }, [emailLogs]);

  const eligibleParticipants = useMemo(
    () =>
      participants.filter((participant) => participant.status !== "cancelled"),
    [participants]
  );

  const nonCaptainParticipants = useMemo(
    () =>
      eligibleParticipants.filter(
        (participant) => !participant.is_table_captain
      ),
    [eligibleParticipants]
  );

  const assignmentsByParticipant = useMemo(() => {
    const result: Record<string, string> = {};

    // Add regular assignments from the assignments table
    assignments.forEach((assignment) => {
      result[assignment.participant_id] = assignment.restaurant_id;
    });

    // Add captain assignments from restaurants table
    restaurants.forEach((restaurant) => {
      if (restaurant.assigned_captain_id) {
        result[restaurant.assigned_captain_id] = restaurant.id;
      }
    });

    return result;
  }, [assignments, restaurants]);

  const assignmentsByRestaurant = useMemo(() => {
    return assignments.reduce<Record<string, string[]>>((acc, assignment) => {
      if (!acc[assignment.restaurant_id]) {
        acc[assignment.restaurant_id] = [];
      }
      acc[assignment.restaurant_id].push(assignment.participant_id);
      return acc;
    }, {});
  }, [assignments]);

  const unassignedParticipants = useMemo(
    () =>
      nonCaptainParticipants.filter(
        (participant) => !assignmentsByParticipant[participant.id]
      ),
    [nonCaptainParticipants, assignmentsByParticipant]
  );

  const filteredPeople = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return eligibleParticipants;
    }
    return eligibleParticipants.filter((participant) => {
      const assignmentRestaurantId = assignmentsByParticipant[participant.id];
      const restaurantName = assignmentRestaurantId
        ? restaurants.find(
            (restaurant) => restaurant.id === assignmentRestaurantId
          )?.name ?? ""
        : "";
      return (
        participant.attendee_name.toLowerCase().includes(term) ||
        participant.attendee_email.toLowerCase().includes(term) ||
        participant.pretix_id.toLowerCase().includes(term) ||
        restaurantName.toLowerCase().includes(term)
      );
    });
  }, [
    eligibleParticipants,
    searchQuery,
    assignmentsByParticipant,
    restaurants,
  ]);

  const filteredRestaurants = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return restaurants;
    }
    return restaurants.filter(
      (restaurant) =>
        restaurant.name.toLowerCase().includes(term) ||
        restaurant.address.toLowerCase().includes(term)
    );
  }, [restaurants, searchQuery]);

  const isBusy =
    assignMutation.isPending ||
    unassignMutation.isPending ||
    setEventStatusMutation.isPending ||
    activityLogger.isPending;

  const isFinalized = eventStatus.state === "finalized";

  const handleManualAssign = async (
    participantId: string,
    restaurantId: string | null
  ) => {
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to make changes.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!restaurantId) {
        await unassignMutation.mutateAsync(participantId);
        await activityLogger.mutateAsync({
          event_type: "assignment",
          description: "Participant unassigned manually",
          actor: null,
          metadata: { participantId },
        });
        toast({
          title: "Participant unassigned",
          description: "This person has been removed from their table.",
        });
      } else {
        await assignMutation.mutateAsync({
          participant_id: participantId,
          restaurant_id: restaurantId,
        });
        if (eventStatus.state === "captains_assigned") {
          await setEventStatusMutation.mutateAsync("participants_assigned");
        }
        await activityLogger.mutateAsync({
          event_type: "assignment",
          description: "Participant reassigned manually",
          actor: null,
          metadata: { participantId, restaurantId },
        });
        toast({
          title: "Participant assigned",
          description: "Assignment saved successfully.",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Assignment failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddToRestaurant = async (
    restaurantId: string,
    participantId: string
  ) => {
    if (!participantId) return;
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to add participants.",
        variant: "destructive",
      });
      return;
    }

    try {
      await assignMutation.mutateAsync({
        participant_id: participantId,
        restaurant_id: restaurantId,
      });
      if (eventStatus.state === "captains_assigned") {
        await setEventStatusMutation.mutateAsync("participants_assigned");
      }
      await activityLogger.mutateAsync({
        event_type: "assignment",
        description: "Participant assigned from restaurant card",
        actor: null,
        metadata: { participantId, restaurantId },
      });
      toast({
        title: "Participant added",
        description: "The participant was assigned to the restaurant.",
      });
      setPendingAdd((prev) => ({ ...prev, [restaurantId]: "" }));
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to assign participant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    if (!assignments.length) {
      toast({
        title: "No assignments yet",
        description: "Assign participants before exporting.",
      });
      return;
    }

    const rosters = buildRestaurantRosters(
      restaurants,
      participants,
      assignments.map((assignment) => ({
        participantId: assignment.participant_id,
        restaurantId: assignment.restaurant_id,
      }))
    );

    const csv = generateAssignmentCsv(rosters);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `blind-peering-assignments-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(buildRosterPrintHtml(rosters));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }

    await activityLogger.mutateAsync({
      event_type: "assignment",
      description: "Exported assignments",
      actor: null,
      metadata: {
        restaurantCount: rosters.length,
      },
    });

    toast({
      title: "Export ready",
      description: "CSV downloaded and print preview opened.",
    });
  };

  const handleSendIndividualEmail = async (participantId: string) => {
    const participant = participantById.get(participantId);
    if (!participant) return;

    const assignmentRestaurantId = assignmentsByParticipant[participantId];
    if (!assignmentRestaurantId) {
      toast({
        title: "No assignment",
        description: "This participant is not assigned to a restaurant yet.",
        variant: "destructive",
      });
      return;
    }

    const restaurant = restaurants.find((r) => r.id === assignmentRestaurantId);
    if (!restaurant) return;

    const captain = restaurant.assigned_captain_id
      ? participantById.get(restaurant.assigned_captain_id) ?? null
      : null;

    const tableGuestIds = assignmentsByRestaurant[assignmentRestaurantId] ?? [];
    const tableGuests = tableGuestIds
      .map((id) => participantById.get(id))
      .filter((p): p is typeof participants[0] => Boolean(p))
      .filter((p) => p.id !== participantId);

    try {
      await sendEmailMutation.mutateAsync({
        participant,
        restaurant,
        captain,
        tableGuests,
        emailType: "individual_update",
      });
      await activityLogger.mutateAsync({
        event_type: "email",
        description: `Sent individual assignment email to ${participant.attendee_name}`,
        actor: null,
        metadata: { participantId, restaurantId: restaurant.id },
      });
      toast({
        title: "Email sent",
        description: `Assignment email sent to ${participant.attendee_name}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to send email",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const dataLoading =
    participantsLoading || restaurantsLoading || assignmentsLoading;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Assignments
        </h2>
        <p className="text-muted-foreground">
          Search, reassign, or clear participant restaurant placements.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by person name, email, Pretix ID, or restaurant…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-0.5 h-8 w-8"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2 bg-transparent"
              onClick={handleExport}
              disabled={!assignments.length}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="people" className="gap-2">
            <Users className="h-4 w-4" />
            By People
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            By Restaurant
          </TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Participants ({filteredPeople.length})</CardTitle>
              <CardDescription>
                Assign or move individuals between restaurants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : filteredPeople.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No results</AlertTitle>
                  <AlertDescription>
                    Try adjusting your filters or import additional
                    participants.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {filteredPeople.map((participant) => {
                    const assignmentRestaurantId =
                      assignmentsByParticipant[participant.id] ?? "";
                  const restaurant = assignmentRestaurantId
                    ? restaurants.find(
                        (item) => item.id === assignmentRestaurantId
                      )
                    : undefined;
                  const isCaptain = participant.is_table_captain;
                  const firstEmail = firstEmailByParticipant.get(participant.id);
                  const firstEmailDate = firstEmail ? new Date(firstEmail.sentAt) : null;
                  const firstEmailLabel =
                    firstEmailDate && !Number.isNaN(firstEmailDate.getTime())
                      ? firstEmailDate.toLocaleString()
                      : null;

                  return (
                      <div
                        key={participant.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">
                              {participant.attendee_name}
                            </p>
                            {isCaptain && (
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary"
                              >
                                Captain
                              </Badge>
                            )}
                            {participant.status === "late_joiner" && (
                              <Badge
                                variant="outline"
                                className="text-warning border-warning"
                              >
                                Late joiner
                              </Badge>
                            )}
                            {firstEmail && firstEmailLabel && (
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15"
                                title={`First email (${firstEmail.emailType.replace("_", " ")}) sent ${firstEmailLabel}`}
                              >
                                <MailCheck className="h-3.5 w-3.5 text-emerald-500" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {participant.attendee_email}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="text-right sm:text-left">
                            <p className="text-xs text-muted-foreground">
                              Current assignment
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {restaurant ? restaurant.name : "Unassigned"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {assignmentRestaurantId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendIndividualEmail(participant.id)}
                                disabled={sendEmailMutation.isPending}
                                title="Send assignment email"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Select
                              value={assignmentRestaurantId || "unassigned"}
                              onValueChange={(value) =>
                                handleManualAssign(
                                  participant.id,
                                  value === "unassigned" ? null : value
                                )
                              }
                              disabled={isBusy || isCaptain || isFinalized}
                            >
                              <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Assign restaurant" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">
                                  Unassigned
                                </SelectItem>
                                {restaurants.map((restaurantOption) => (
                                  <SelectItem
                                    key={restaurantOption.id}
                                    value={restaurantOption.id}
                                  >
                                    {restaurantOption.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="restaurants" className="space-y-4">
          {dataLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-10">
                <Spinner className="h-6 w-6" />
              </CardContent>
            </Card>
          ) : filteredRestaurants.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No restaurants match</AlertTitle>
              <AlertDescription>
                Double-check your search input.
              </AlertDescription>
            </Alert>
          ) : (
            filteredRestaurants.map((restaurant) => {
              const assignedParticipantIds =
                assignmentsByRestaurant[restaurant.id] ?? [];
              const assignedParticipants = assignedParticipantIds
                .map((participantId) => participantById.get(participantId))
                .filter((participant): participant is Participant =>
                  Boolean(participant)
                );

              const captain = restaurant.assigned_captain_id
                ? participantById.get(restaurant.assigned_captain_id)
                : undefined;
              const occupancy = assignedParticipants.length + (captain ? 1 : 0);
              const ratio = restaurant.max_seats
                ? occupancy / restaurant.max_seats
                : 0;

              return (
                <Card key={restaurant.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle>{restaurant.name}</CardTitle>
                        <CardDescription>{restaurant.address}</CardDescription>
                      </div>
                      <Badge className={occupancyBadge(ratio)}>
                        {occupancy}/{restaurant.max_seats}
                      </Badge>
                    </div>
                    {captain && (
                      <div className="mt-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                        <Users className="h-4 w-4" />
                        <span>
                          Captain: {captain.attendee_name} (
                          {captain.attendee_email})
                        </span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {assignedParticipants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No participants assigned yet.
                        </p>
                      ) : (
                        assignedParticipants.map((participant) => (
                          <div
                            key={participant.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 p-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {participant.attendee_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {participant.attendee_email}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-muted-foreground"
                              onClick={() =>
                                handleManualAssign(participant.id, null)
                              }
                              disabled={isBusy || isFinalized}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              Move
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={pendingAdd[restaurant.id] ?? "none"}
                        onValueChange={(value) => {
                          setPendingAdd((prev) => ({
                            ...prev,
                            [restaurant.id]: value,
                          }));
                          if (value && value !== "none") {
                            void handleAddToRestaurant(restaurant.id, value);
                          }
                        }}
                        disabled={
                          isBusy ||
                          unassignedParticipants.length === 0 ||
                          isFinalized
                        }
                      >
                        <SelectTrigger className="w-[260px]">
                          <SelectValue
                            placeholder={
                              unassignedParticipants.length
                                ? "Add participant…"
                                : "No unassigned participants"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Select participant
                          </SelectItem>
                          {unassignedParticipants.map((participant) => (
                            <SelectItem
                              key={participant.id}
                              value={participant.id}
                            >
                              {participant.attendee_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
