import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Shuffle,
  Users,
  AlertTriangle,
  Mail,
  Lock,
  UserPlus,
} from "lucide-react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useAssignments } from "@/hooks/use-assignments";
import { useEventStatus } from "@/hooks/use-event-status";
import { useToast } from "@/hooks/use-toast";
import { useActivityLogger } from "@/hooks/use-activity-log";
import { useEmails } from "@/hooks/use-emails";
import { supabase } from "@/services/supabase";
import { queryKeys } from "@/lib/query-keys";
import {
  buildRestaurantRosters,
  planCaptainAssignments,
  planParticipantAssignments,
} from "@/lib/assignment-utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ShuffleWarningDialog } from "@/components/shuffle-warning-dialog";

const WORKFLOW_LABELS: Record<string, string> = {
  setup: "Setup",
  captains_assigned: "Captains Assigned",
  participants_assigned: "Participants Assigned",
  finalized: "Finalized",
};

export function DashboardOverview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const activityLogger = useActivityLogger();
  const { participants } = useParticipants();
  const { restaurants } = useRestaurants();
  const { assignments } = useAssignments();
  const { eventStatus, setEventStatusMutation } = useEventStatus();
  const { sendBulkEmailsMutation } = useEmails();

  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [isAssigningCaptains, setIsAssigningCaptains] = useState(false);
  const [isAssigningParticipants, setIsAssigningParticipants] = useState(false);
  const [isAssigningUnassigned, setIsAssigningUnassigned] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [pendingEmailType, setPendingEmailType] = useState<
    "initial_assignment" | "final_assignment" | null
  >(null);

  const participantById = useMemo(
    () =>
      new Map(participants.map((participant) => [participant.id, participant])),
    [participants]
  );

  const assignableParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.status === "registered" ||
          participant.status === "late_joiner"
      ),
    [participants]
  );

  const nonCaptainParticipants = useMemo(
    () =>
      assignableParticipants.filter(
        (participant) => !participant.is_table_captain
      ),
    [assignableParticipants]
  );

  const unassignedCount = useMemo(() => {
    const assignedParticipantIds = new Set(
      assignments.map((a) => a.participant_id)
    );
    const captainIds = new Set(
      restaurants.map((r) => r.assigned_captain_id).filter(Boolean)
    );
    return assignableParticipants.filter(
      (p) => !assignedParticipantIds.has(p.id) && !captainIds.has(p.id)
    ).length;
  }, [assignableParticipants, assignments, restaurants]);

  const activeCaptains = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.is_table_captain && participant.status !== "cancelled"
      ),
    [participants]
  );

  const restaurantsWithCaptain = useMemo(
    () =>
      restaurants.filter((restaurant) =>
        Boolean(restaurant.assigned_captain_id)
      ),
    [restaurants]
  );

  const totalCapacity = useMemo(
    () =>
      restaurants.reduce(
        (total, restaurant) => total + restaurant.max_seats,
        0
      ),
    [restaurants]
  );
  const nonCaptainCapacity = Math.max(totalCapacity - restaurants.length, 0);

  const assignedParticipantsCount = useMemo(() => {
    return assignments.filter((assignment) => {
      const participant = participantById.get(assignment.participant_id);
      return participant && participant.status !== "cancelled";
    }).length;
  }, [assignments, participantById]);

  const assignedNonCaptains = useMemo(() => {
    return assignments.filter((assignment) => {
      const participant = participantById.get(assignment.participant_id);
      return (
        participant &&
        participant.status !== "cancelled" &&
        !participant.is_table_captain
      );
    }).length;
  }, [assignments, participantById]);

  const participantsAwaitingAssignment = Math.max(
    nonCaptainParticipants.length - assignedNonCaptains,
    0
  );
  const capacityShortfall = nonCaptainParticipants.length > nonCaptainCapacity;
  const captainShortfall = activeCaptains.length < restaurants.length;

  const assignmentProgress =
    nonCaptainCapacity === 0
      ? 0
      : Math.min((assignedNonCaptains / nonCaptainCapacity) * 100, 100);
  const captainCoverage =
    restaurants.length === 0
      ? 0
      : Math.min(
          (restaurantsWithCaptain.length / restaurants.length) * 100,
          100
        );

  const workflowLabel = WORKFLOW_LABELS[eventStatus.state] ?? "Unknown";
  const isFinalized = eventStatus.state === "finalized";
  const lastUpdatedDisplay =
    eventStatus.updated_at && !eventStatus.updated_at.startsWith("1970-")
      ? new Date(eventStatus.updated_at).toLocaleString()
      : "—";

  const handleAssignCaptains = async () => {
    if (isAssigningCaptains) return;
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description: "Captains cannot be reassigned after finalization.",
      });
      return;
    }
    if (!restaurants.length) {
      toast({
        title: "No restaurants available",
        description: "Add restaurants before assigning captains.",
        variant: "destructive",
      });
      return;
    }
    if (activeCaptains.length < restaurants.length) {
      toast({
        title: "Not enough captains",
        description: `You need ${restaurants.length} captains but only have ${activeCaptains.length}.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAssigningCaptains(true);
      const plan = planCaptainAssignments(restaurants, activeCaptains);

      // Update each restaurant's captain assignment individually
      for (const { restaurantId, captainId } of plan) {
        const { error } = await supabase
          .from("restaurants")
          .update({ assigned_captain_id: captainId })
          .eq("id", restaurantId);
        if (error) throw error;
      }

      await setEventStatusMutation.mutateAsync("captains_assigned");
      await activityLogger.mutateAsync({
        event_type: "captain",
        description: `Assigned ${plan.length} captains`,
        actor: null,
        metadata: {
          restaurantCount: plan.length,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: queryKeys.restaurants.all,
      });
      toast({
        title: "Captains assigned",
        description: "Each restaurant now has a table captain.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to assign captains",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningCaptains(false);
    }
  };

  const executeParticipantAssignment = async () => {
    if (isAssigningParticipants) return;
    if (!restaurantsWithCaptain.length) {
      toast({
        title: "Assign captains first",
        description:
          "Participants can only be placed once all restaurants have captains.",
        variant: "destructive",
      });
      return;
    }
    if (!nonCaptainParticipants.length) {
      toast({
        title: "No participants to assign",
        description: "Import or mark attendees as registered before assigning.",
      });
      return;
    }

    try {
      setIsAssigningParticipants(true);
      const { assignments: plannedAssignments, unassigned } =
        planParticipantAssignments(restaurants, assignableParticipants);

      // Clear all existing assignments
      if (assignments.length > 0) {
        const { error: clearError } = await supabase
          .from("assignments")
          .delete()
          .in(
            "id",
            assignments.map((a) => a.id)
          );
        if (clearError) throw clearError;
      }

      if (plannedAssignments.length) {
        const payload = plannedAssignments.map(
          ({ participantId, restaurantId }) => ({
            participant_id: participantId,
            restaurant_id: restaurantId,
            assigned_at: new Date().toISOString(),
          })
        );
        const { error: insertError } = await supabase
          .from("assignments")
          .insert(payload);
        if (insertError) throw insertError;
      }

      await setEventStatusMutation.mutateAsync("participants_assigned");
      await activityLogger.mutateAsync({
        event_type: "assignment",
        description: `Assigned ${plannedAssignments.length} participants`,
        actor: null,
        metadata: {
          unassignedCount: unassigned.length,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.all,
      });
      toast({
        title: "Participants assigned",
        description:
          plannedAssignments.length === 0
            ? "No participants could be assigned."
            : unassigned.length
            ? `${plannedAssignments.length} assigned. ${unassigned.length} could not be placed due to capacity.`
            : "All eligible participants have been assigned.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Assignment failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningParticipants(false);
      setShowReassignDialog(false);
    }
  };

  const handleAssignParticipants = () => {
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to reshuffle.",
      });
      return;
    }
    // Allow overbooking - the assignment algorithm will distribute fairly
    // Only show warning dialog if there are existing assignments
    if (assignments.length > 0) {
      setShowReassignDialog(true);
    } else {
      void executeParticipantAssignment();
    }
  };

  const handleAssignUnassigned = async () => {
    if (isAssigningUnassigned) return;
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to reshuffle.",
      });
      return;
    }
    if (!restaurantsWithCaptain.length) {
      toast({
        title: "Assign captains first",
        description:
          "Participants can only be placed once all restaurants have captains.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAssigningUnassigned(true);

      // Get IDs of already assigned participants
      const assignedParticipantIds = new Set(
        assignments.map((a) => a.participant_id)
      );

      // Filter to only unassigned, assignable participants
      const unassignedParticipants = assignableParticipants.filter(
        (p) => !assignedParticipantIds.has(p.id) && !p.is_table_captain
      );

      if (unassignedParticipants.length === 0) {
        toast({
          title: "No unassigned participants",
          description: "All eligible participants are already assigned.",
        });
        return;
      }

      const { assignments: plannedAssignments, unassigned } =
        planParticipantAssignments(restaurants, unassignedParticipants);

      if (plannedAssignments.length) {
        const payload = plannedAssignments.map(
          ({ participantId, restaurantId }) => ({
            participant_id: participantId,
            restaurant_id: restaurantId,
            assigned_at: new Date().toISOString(),
          })
        );
        const { error: insertError } = await supabase
          .from("assignments")
          .insert(payload);
        if (insertError) throw insertError;
      }

      await setEventStatusMutation.mutateAsync("participants_assigned");
      await activityLogger.mutateAsync({
        event_type: "assignment",
        description: `Assigned ${plannedAssignments.length} unassigned participants`,
        actor: null,
        metadata: {
          unassignedCount: unassigned.length,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.all,
      });
      toast({
        title: "Unassigned participants placed",
        description:
          plannedAssignments.length === 0
            ? "No participants could be assigned."
            : unassigned.length
            ? `${plannedAssignments.length} assigned. ${unassigned.length} could not be placed due to capacity.`
            : `All ${plannedAssignments.length} unassigned participants have been placed.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Assignment failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningUnassigned(false);
    }
  };

  const handleSendBulkEmails = async (
    emailType: "initial_assignment" | "final_assignment"
  ) => {
    if (sendBulkEmailsMutation.isPending) return;

    if (!assignments.length) {
      toast({
        title: "No assignments yet",
        description: "Assign participants before sending emails.",
        variant: "destructive",
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

    const emails = rosters.flatMap((roster) => {
      const tableGuests = roster.participants;
      const allParticipants = [...tableGuests, roster.captain].filter(
        (p): p is (typeof participants)[0] => Boolean(p)
      );

      return allParticipants.map((participant) => ({
        participant,
        restaurant: roster.restaurant,
        captain: roster.captain,
        tableGuests: tableGuests.filter((p) => p.id !== participant.id),
        emailType,
      }));
    });

    if (emails.length === 0) {
      toast({
        title: "No recipients found",
        description: "Ensure participants are assigned before sending emails.",
        variant: "destructive",
      });
      return;
    }

    try {
      setPendingEmailType(emailType);
      await sendBulkEmailsMutation.mutateAsync({ emails, emailType });
      await activityLogger.mutateAsync({
        event_type: "email",
        description: `Sent ${emailType.replace(
          "_",
          " "
        )} emails to all participants`,
        actor: null,
        metadata: { emailCount: emails.length, emailType },
      });
      toast({
        title: "Emails sent",
        description: `Successfully sent ${emails.length} assignment emails.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to send emails",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingEmailType(null);
    }
  };

  const handleFinalize = async () => {
    if (isFinalizing) return;
    if (isFinalized) {
      toast({
        title: "Already finalized",
        description: "The event is already locked.",
      });
      return;
    }
    if (assignments.length === 0) {
      toast({
        title: "Assign participants first",
        description: "Finalize after participants have been placed.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsFinalizing(true);
      await setEventStatusMutation.mutateAsync("finalized");
      await activityLogger.mutateAsync({
        event_type: "assignment",
        description: "Event finalized",
        actor: null,
        metadata: {
          assignments: assignments.length,
        },
      });
      toast({
        title: "Event finalized",
        description: "Assignments are now locked.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to finalize",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Event Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor readiness across restaurants, captains, and participants.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          State: {workflowLabel}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <CardDescription>Total imported from Pretix</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {participants.length}
              </span>
              <Badge variant="outline">{unassignedCount} unassigned</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Captains Ready
            </CardTitle>
            <CardDescription>
              Active captains vs restaurants needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {activeCaptains.length}
              </span>
              <Badge variant="outline">{restaurants.length} restaurants</Badge>
            </div>
            <Progress value={captainCoverage} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Assignments Progress
            </CardTitle>
            <CardDescription>
              Participants placed into restaurants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {assignedNonCaptains}
              </span>
              <Badge variant="outline">{nonCaptainCapacity} capacity</Badge>
            </div>
            <Progress value={assignmentProgress} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
            <CardDescription>Capacity including captains</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {restaurants.length}
              </span>
              <Badge variant="outline">{totalCapacity} seats</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {(capacityShortfall || captainShortfall) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Setup requires attention</AlertTitle>
          <AlertDescription>
            {capacityShortfall && (
              <p>
                There are {nonCaptainParticipants.length} assignable
                participants but only {nonCaptainCapacity} seats for attendees.
                Overbooking will be distributed fairly across restaurants.
              </p>
            )}
            {captainShortfall && (
              <p>
                Only {activeCaptains.length} captains available for{" "}
                {restaurants.length} restaurants. Recruit additional captains
                before assigning Restaurants.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Run assignments or notify attendees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleAssignCaptains}
              disabled={isAssigningCaptains || captainShortfall || isFinalized}
              title={
                captainShortfall
                  ? "You need at least as many captains as restaurants."
                  : isFinalized
                  ? "Assignments are locked."
                  : undefined
              }
            >
              {isAssigningCaptains ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Assign all captains
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleAssignParticipants}
              disabled={
                isAssigningParticipants || isFinalized || captainShortfall
              }
              title={
                captainShortfall
                  ? "Assign captains before shuffling participants."
                  : isFinalized
                  ? "Assignments are locked."
                  : undefined
              }
            >
              {isAssigningParticipants ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Shuffle className="h-4 w-4" />
              )}
              Assign all participants
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleAssignUnassigned}
              disabled={
                isAssigningUnassigned || isFinalized || captainShortfall
              }
              title={
                captainShortfall
                  ? "Assign captains before placing participants."
                  : isFinalized
                  ? "Assignments are locked."
                  : undefined
              }
            >
              {isAssigningUnassigned ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Assign unassigned to open Restaurants
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={() => handleSendBulkEmails("initial_assignment")}
              disabled={sendBulkEmailsMutation.isPending || !assignments.length}
              title={
                !assignments.length
                  ? "Assign participants before sending emails."
                  : undefined
              }
            >
              {sendBulkEmailsMutation.isPending &&
              pendingEmailType === "initial_assignment" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send Initial Emails
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={() => handleSendBulkEmails("final_assignment")}
              disabled={sendBulkEmailsMutation.isPending || !assignments.length}
              title={
                !assignments.length
                  ? "Assign participants before sending emails."
                  : undefined
              }
            >
              {sendBulkEmailsMutation.isPending &&
              pendingEmailType === "final_assignment" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send Final Emails
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleFinalize}
              disabled={isFinalizing || isFinalized}
            >
              {isFinalizing ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Finalize event
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Overview</CardTitle>
            <CardDescription>
              Track outstanding items before you finalize.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Last updated
              </span>
              <span className="text-sm font-medium text-foreground">
                {lastUpdatedDisplay}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Workflow state
              </span>
              <Badge>{workflowLabel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Restaurants with captains
              </span>
              <span className="text-sm font-medium text-foreground">
                {restaurantsWithCaptain.length} / {restaurants.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Participants awaiting placement
              </span>
              <span className="text-sm font-medium text-foreground">
                {participantsAwaitingAssignment}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total assignments
              </span>
              <span className="text-sm font-medium text-foreground">
                {assignedParticipantsCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <ShuffleWarningDialog
        open={showReassignDialog}
        onOpenChange={setShowReassignDialog}
        onConfirm={executeParticipantAssignment}
      />
    </div>
  );
}
